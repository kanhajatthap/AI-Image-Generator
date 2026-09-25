/**
 * In-memory generated-image cache backed by LRUCache (O(1) get/set + true
 * recency eviction instead of plain insertion-order eviction).
 */

import { LRUCache } from "./lruCache";

interface CacheEntry {
  data: string;
  mimeType: string;
  provider: string;
  timestamp: number;
}

const CACHE_TTL = 30 * 60 * 1000;
const imageCache = new LRUCache<string, CacheEntry>({ max: 200 });

function getCacheKey(
  prompt: string,
  width?: number,
  height?: number,
  seed?: number,
  model?: string,
  style?: string,
): string {
  return `${prompt}|${width || 1024}|${height || 1024}|${seed || 0}|${model || "flux"}|${style || ""}`;
}

export function getCachedImage(
  prompt: string,
  width?: number,
  height?: number,
  seed?: number,
  model?: string,
  style?: string,
): { data: string; mimeType: string; provider: string } | null {
  const key = getCacheKey(prompt, width, height, seed, model, style);
  const entry = imageCache.get(key);

  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    imageCache.delete(key);
    return null;
  }
  return { data: entry.data, mimeType: entry.mimeType, provider: entry.provider };
}

export function setCachedImage(
  prompt: string,
  data: string,
  mimeType: string,
  width?: number,
  height?: number,
  seed?: number,
  model?: string,
  style?: string,
  provider = "pollinations",
): void {
  const key = getCacheKey(prompt, width, height, seed, model, style);
  imageCache.set(key, { data, mimeType, provider, timestamp: Date.now() });
}