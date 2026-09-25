import { describe, expect, it } from "vitest";
import { markPromptSeen } from "../lib/bloomFilter";

describe("markPromptSeen (Bloom duplicate detection)", () => {
  it("marks the same prompt as seen on the second call", () => {
    expect(markPromptSeen("bloom-user", "a shiny red car")).toBe(false);
    expect(markPromptSeen("bloom-user", "a shiny red car")).toBe(true);
  });

  it("distinguishes between prompts", () => {
    markPromptSeen("bloom-user2", "a blue sky");
    expect(markPromptSeen("bloom-user2", "a green tree")).toBe(false);
  });

  it("distinguishes between users", () => {
    markPromptSeen("user-A", "same prompt here");
    expect(markPromptSeen("user-B", "same prompt here")).toBe(false);
    expect(markPromptSeen("user-A", "same prompt here")).toBe(true);
  });
});