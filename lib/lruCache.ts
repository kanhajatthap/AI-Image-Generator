/**
 * LRUCache — a generic, fixed-capacity Least-Recently-Used cache built on a
 * hash map (O(1) lookup) plus a doubly-linked list (O(1) recency re-ordering).
 *
 *   - `get(key)`  makes a key hot: the node is moved to the head of the list.
 *   - `set(key, v)` inserts at the head; when capacity is exceeded the tail
 *     (least-recently-used) node is evicted.
 *   - Optional per-entry `ttlMs` removes stale entries on read.
 *
 * Data structures & complexity
 *   - Hash map:       key  -> pointer to the linked-list node   — O(1)
 *   - Doubly-linked list: head = MRU, tail = LRU                — O(1) splice/evict
 *
 * This is the classic "LRU" interview problem implemented generically so it can
 * back the image cache, the per-user rate-limit buckets and the per-user bloom
 * filters elsewhere in the app.
 */

type LRUNode<V> = {
  key: string;
  value: V;
  loadedAt: number;
  prev: LRUNode<V> | null;
  next: LRUNode<V> | null;
};

export interface LRUCacheOptions {
  /** Maximum number of live entries. LRU tail is evicted above this. */
  max: number;
  /** Optional time-to-live; entries older than this are dropped on read. */
  ttlMs?: number;
}

export interface LRUCacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  capacity: number;
}

export class LRUCache<K extends string | number, V> {
  private readonly map = new Map<K, LRUNode<V>>();
  private head: LRUNode<V> | null = null; // most recently used
  private tail: LRUNode<V> | null = null; // least recently used (eviction candidate)
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private readonly max: number;
  private readonly ttlMs?: number;

  constructor({ max, ttlMs }: LRUCacheOptions) {
    if (!Number.isInteger(max) || max <= 0) {
      throw new Error("LRUCache max must be a positive integer.");
    }
    this.max = max;
    this.ttlMs = ttlMs;
  }

  get size(): number {
    return this.map.size;
  }

  /** Highlights/reads a key. Returns undefined when missing or expired. */
  get(key: K): V | undefined {
    const node = this.map.get(key);
    if (!node) {
      this.misses += 1;
      return undefined;
    }

    if (this.ttlMs !== undefined && Date.now() - node.loadedAt > this.ttlMs) {
      this.delete(key);
      this.evictions += 1;
      this.misses += 1;
      return undefined;
    }

    this.hits += 1;
    this.moveToFront(node);
    return node.value;
  }

  /** Inserts or refreshes a key at the MRU position. */
  set(key: K, value: V): void {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      existing.loadedAt = Date.now();
      this.moveToFront(existing);
      return;
    }

    const node: LRUNode<V> = {
      key: String(key),
      value,
      loadedAt: Date.now(),
      prev: null,
      next: null,
    };
    this.map.set(key, node);
    this.linkToFront(node);

    if (this.map.size > this.max) {
      const lru = this.tail;
      if (lru) {
        this.removeNode(lru);
        this.map.delete(lru.key as K);
        this.evictions += 1;
      }
    }
  }

  /** True when the key exists and is not expired (also touches recency). */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.removeNode(node);
    this.map.delete(key);
    return true;
  }

  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  stats(): LRUCacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.map.size,
      capacity: this.max,
    };
  }

  private linkToFront(node: LRUNode<V>): void {
    node.next = this.head;
    node.prev = null;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  /** Unlinks a node from the list (O(1) — pointers only). */
  private removeNode(node: LRUNode<V>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
    node.prev = null;
    node.next = null;
  }

  /** Splices an existing node to the head in O(1). */
  private moveToFront(node: LRUNode<V>): void {
    if (node === this.head) return;
    this.removeNode(node);
    this.linkToFront(node);
  }
}