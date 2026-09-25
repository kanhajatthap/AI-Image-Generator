import { describe, expect, it } from "vitest";
import { LRUCache } from "../lib/lruCache";

describe("LRUCache", () => {
  it("evicts the least-recently-used entry when over capacity", () => {
    const cache = new LRUCache<string, number>({ max: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // a is now most-recent
    cache.set("c", 3); // b gets evicted
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });

  it("expires entries after ttl", async () => {
    const cache = new LRUCache<string, number>({ max: 10, ttlMs: 50 });
    cache.set("x", 42);
    expect(cache.get("x")).toBe(42);
    await new Promise((r) => setTimeout(r, 80));
    expect(cache.get("x")).toBeUndefined();
  });

  it("keeps entries while within ttl", () => {
    const cache = new LRUCache<string, number>({ max: 10, ttlMs: 10_000 });
    cache.set("x", 1);
    expect(cache.get("x")).toBe(1);
  });

  it("delete removes entries", () => {
    const cache = new LRUCache<string, number>({ max: 10 });
    cache.set("a", 1);
    cache.delete("a");
    expect(cache.get("a")).toBeUndefined();
  });
});