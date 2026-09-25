import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, MAX_REQUESTS } from "../lib/rateLimit";

describe("checkRateLimit (sliding window)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to MAX_REQUESTS calls in the window", () => {
    for (let i = 0; i < MAX_REQUESTS; i++) {
      expect(checkRateLimit("rate-user").allowed).toBe(true);
    }
    expect(checkRateLimit("rate-user").allowed).toBe(false);
  });

  it("different users have independent windows", () => {
    for (let i = 0; i < MAX_REQUESTS + 2; i++) {
      checkRateLimit("busy-user");
    }
    expect(checkRateLimit("fresh-user").allowed).toBe(true);
  });

  it("resets after the window has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T00:00:00Z"));
    for (let i = 0; i < MAX_REQUESTS; i++) {
      checkRateLimit("expire-user");
    }
    expect(checkRateLimit("expire-user").allowed).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(checkRateLimit("expire-user").allowed).toBe(true);
  });

  it("reports retryAfter seconds on denial", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T00:00:00Z"));
    for (let i = 0; i < MAX_REQUESTS; i++) {
      checkRateLimit("retry-user");
    }
    const result = checkRateLimit("retry-user");
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });
});