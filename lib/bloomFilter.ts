/**
 * Per-user duplicate-prompt detection using Bloom filters, evicted via LRU.
 *
 * Bloom filter
 *   A space-efficient probabilistic set. An item is hashed `k` times
 *   (double-hashing: h_i = h1 + i * h2) and `k` bits are set. Membership checks
 *   are O(k) and can produce FALSE POSITIVES (harmless here — it only triggers a
 *   subtle "you asked this before" hint) but never false negatives (a truly
 *   duplicate prompt is always caught).
 *
 *   The bit array is pre-sized from `expectedItems` and a target
 *   false-positive rate so memory stays constant regardless of how long the
 *   server runs: m = -n·ln(p) / ln(2)^2 bits, k = (m/n)·ln(2).
 *
 * LRU integration
 *   Every user owns one BloomFilter. The filters live in an LRUCache so inactive
 *   accounts are evicted and never leak memory; when a user's bloom fills up it
 *   is rebuilt fresh, resetting its duplicate memory.
 */

import { LRUCache } from "./lruCache";

export const BLOOM_EXPECTED_ITEMS = 5000;
export const BLOOM_FALSE_POSITIVE_RATE = 0.02;
const MAX_USERS = 20_000;
const USER_BLOOM_TTL_MS = 6 * 60 * 60 * 1000; // 6h of inactivity resets a user

export class BloomFilter {
  private readonly bits: Uint8Array;
  private readonly bitSize: number;
  private readonly hashCount: number;
  private inserted = 0;

  constructor(expectedItems: number, falsePositiveRate: number) {
    if (!(expectedItems > 0 && falsePositiveRate > 0 && falsePositiveRate < 1)) {
      throw new Error("BloomFilter needs expectedItems>0 and 0<falsePositiveRate<1.");
    }
    const ln2 = Math.LN2;
    const bits = Math.ceil((-expectedItems * Math.log(falsePositiveRate)) / (ln2 * ln2));
    this.bitSize = bits;
    this.bits = new Uint8Array(Math.ceil(bits / 8));
    this.hashCount = Math.max(1, Math.round((bits / expectedItems) * ln2));
  }

  private hashAt(item: string, i: number): number {
    // Double hashing: h1 and h2 are independent 32-bit hashes; combining them
    // with a running multiplier produces `hashCount` uniformly spread indexes.
    const h1 = BloomFilter.fnv1a(item) >>> 0;
    const h2 = BloomFilter.cyrb32(item) >>> 0;
    return (h1 + i * h2) % this.bitSize;
  }

  add(item: string): void {
    for (let i = 0; i < this.hashCount; i++) {
      const bit = this.hashAt(item, i);
      this.bits[bit >> 3] |= 1 << (bit & 7);
    }
    this.inserted += 1;
  }

  /** Possible membership — may return true falsely, never falsely negative. */
  contains(item: string): boolean {
    for (let i = 0; i < this.hashCount; i++) {
      const bit = this.hashAt(item, i);
      if ((this.bits[bit >> 3] & (1 << (bit & 7))) === 0) return false;
    }
    return true;
  }

  get fillRatio(): number {
    return Math.min(1, this.inserted / BLOOM_EXPECTED_ITEMS);
  }

  /** Standard FNV-1a 32-bit hash. */
  static fnv1a(input: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  /** cyrb53-style 32-bit mix, independent of FNV for the second hash. */
  static cyrb32(input: string): number {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < input.length; i++) {
      const ch = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    return (h1 ^ (h2 ^ (h2 >>> 13))) >>> 0;
  }
}

function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase().replace(/\s+/g, " ").trim();
}

const userBlooms = new LRUCache<string, BloomFilter>({
  max: MAX_USERS,
  ttlMs: USER_BLOOM_TTL_MS,
});

/**
 * Registers `prompt` for a user and returns whether the same normalized prompt
 * was already seen (Bloom membership before inserting). Safe to call on every
 * chat turn; a full bloom is silently rebuilt to reset its duplicate memory.
 */
export function markPromptSeen(userId: string, prompt: string): boolean {
  const key = normalizePrompt(prompt);
  let bloom = userBlooms.get(userId);
  if (!bloom) {
    bloom = new BloomFilter(BLOOM_EXPECTED_ITEMS, BLOOM_FALSE_POSITIVE_RATE);
    userBlooms.set(userId, bloom);
  } else if (bloom.fillRatio >= 1) {
    // Bloom saturated — rebuild a fresh filter (drops duplicate memory).
    bloom = new BloomFilter(BLOOM_EXPECTED_ITEMS, BLOOM_FALSE_POSITIVE_RATE);
    userBlooms.set(userId, bloom);
  }

  const seen = bloom.contains(key);
  bloom.add(key);
  return seen;
}