import { describe, expect, it } from "vitest";
import { fallbackRegexFacts, buildMemorySystemPrompt, MAX_MEMORY_FACTS } from "../lib/memory";
import { TEXT_SYSTEM_PROMPT } from "../lib/text";

describe("fallbackRegexFacts (name extraction)", () => {
  it("extracts English name intro", () => {
    expect(fallbackRegexFacts("My name is Rohan")).toEqual(["The user's name is Rohan."]);
  });

  it("extracts Hinglish name intro and strips the trailing verb", () => {
    expect(fallbackRegexFacts("mera naam Simran hai")).toEqual(["The user's name is Simran."]);
    expect(fallbackRegexFacts("mera name rahul hai jaldi batana")).toEqual(["The user's name is rahul jaldi batana."]);
  });

  it("ignores 'I am a ...' so jobs aren't captured as names", () => {
    expect(fallbackRegexFacts("I am a software engineer")).toEqual([]);
    expect(fallbackRegexFacts("i am a graphic designer from india")).toEqual([]);
  });

  it("ignores plain questions", () => {
    expect(fallbackRegexFacts("Mera naam kya hai?")).toEqual([]);
    expect(fallbackRegexFacts("What is the weather today?")).toEqual([]);
  });

  it("does not extract from unrelated text", () => {
    expect(fallbackRegexFacts("how do i center a div?")).toEqual([]);
  });
});

describe("fallbackRegexFacts (relative names / general facts)", () => {
  it("extracts wife's name from English", () => {
    expect(fallbackRegexFacts("my wife's name is Pooja")).toEqual(["The user's wife's name is Pooja."]);
  });

  it("extracts wife's name from Hinglish and maps the relation word", () => {
    expect(fallbackRegexFacts("meri wife ka naam Pooja hai")).toEqual(["The user's wife's name is Pooja."]);
    expect(fallbackRegexFacts("meri patni ka naam pooja hai")).toEqual(["The user's wife's name is pooja."]);
    expect(fallbackRegexFacts("meri mummy ka naam Sunita hai")).toEqual(["The user's mother's name is Sunita."]);
  });

  it("strips filler verbs so only the name is captured", () => {
    expect(fallbackRegexFacts("meri wife ka naam Pooja hai aur wo engineer hai")).toEqual([
      "The user's wife's name is Pooja.",
    ]);
  });

  it("ignores questions like 'what is my wife's name?'", () => {
    expect(fallbackRegexFacts("what is the my wife name?")).toEqual([]);
    expect(fallbackRegexFacts("meri wife ka naam kya hai?")).toEqual([]);
  });
});

describe("buildMemorySystemPrompt", () => {
  it("returns the base prompt when there is no memory", () => {
    expect(buildMemorySystemPrompt([])).toBe(TEXT_SYSTEM_PROMPT);
  });

  it("appends private-profile facts when memory exists", () => {
    const full = buildMemorySystemPrompt(["The user's name is Rohan.", "The user lives in Delhi."]);
    expect(full).toContain(TEXT_SYSTEM_PROMPT);
    expect(full).toContain("The user's name is Rohan.");
    expect(full).toContain("never expose them unless the user asks");
  });

  it("sizes are hard-capped at MAX_MEMORY_FACTS", () => {
    const many = Array.from({ length: MAX_MEMORY_FACTS + 10 }, (_, i) => `Fact number ${i}`);
    expect(many.length).toBeGreaterThan(MAX_MEMORY_FACTS);
    expect(buildMemorySystemPrompt(many)).toContain(many[0]);
  });
});