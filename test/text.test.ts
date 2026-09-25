import { describe, expect, it } from "vitest";
import { cleanResponse, looksLikeServiceError } from "../lib/text";

describe("cleanResponse", () => {
  it("unwraps a JSON-encoded string", () => {
    expect(cleanResponse('"hello world"')).toBe("hello world");
  });

  it("pulls message.content out of an OpenAI-style payload", () => {
    const raw = JSON.stringify({ choices: [{ message: { content: "hi there" } }] });
    expect(cleanResponse(raw)).toBe("hi there");
  });

  it("pulls .text and .response fields", () => {
    expect(cleanResponse(JSON.stringify({ text: "from text" }))).toBe("from text");
    expect(cleanResponse(JSON.stringify({ response: "from response" }))).toBe("from response");
  });

  it("strips fence markers from code blocks", () => {
    expect(cleanResponse("```js\nconst x = 1;\n```")).toBe("const x = 1;");
  });

  it("returns plain text untouched", () => {
    expect(cleanResponse("  just some text  ")).toBe("just some text");
  });
});

describe("looksLikeServiceError", () => {
  it("detects credit / key / rate-limit errors", () => {
    expect(looksLikeServiceError("You don't have enough credits, please top up.")).toBe(true);
    expect(looksLikeServiceError("insufficient credits for this request")).toBe(true);
    expect(looksLikeServiceError("rate limit exceeded")).toBe(true);
    expect(looksLikeServiceError("invalid api key provided")).toBe(true);
  });

  it("ignores normal answers", () => {
    expect(looksLikeServiceError("Here is a recipe for pasta.")).toBe(false);
    expect(looksLikeServiceError("The answer is 42.")).toBe(false);
  });
});