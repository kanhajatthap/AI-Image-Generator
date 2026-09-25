/**
 * Image understanding. Primary path is Google Gemini (multi-modal, describes /
 * answers questions about the uploaded image). Falls back to OCR.space for pure
 * text extraction when Gemini isn't configured.
 */

export interface VisionResult {
  text: string;
  visionFrom: "gemini" | "ocr";
}

const HTTP_TIMEOUT_MS = 60000;

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-3.1-flash-lite";

async function analyzeWithGemini(
  buffer: Buffer,
  mimeType: string,
  prompt: string,
): Promise<VisionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: buffer.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      }),
    },
    HTTP_TIMEOUT_MS,
  );

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      typeof json?.error?.message === "string" ? json.error.message : `HTTP ${res.status}`;
    throw new Error(message);
  }

  const parts: Array<{ text?: string }> | undefined = json?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((p) => (typeof p?.text === "string" ? p.text : "")).join("").trim()
    : "";

  if (!text) {
    throw new Error("Gemini vision returned no text.");
  }

  return { text, visionFrom: "gemini" };
}

async function analyzeWithOcr(buffer: Buffer, mimeType: string): Promise<VisionResult> {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) throw new Error("OCR_SPACE_API_KEY is not set.");

  const formData = new FormData();
  formData.append("base64Image", `data:${mimeType};base64,${buffer.toString("base64")}`);
  formData.append("language", "eng");
  formData.append("isOverlayRequired", "false");
  formData.append("scale", "true");
  formData.append("detectOrientation", "true");
  formData.append("apikey", apiKey);

  const ocrResponse = await fetchWithTimeout(
    "https://api.ocr.space/parse/image",
    { method: "POST", body: formData },
    HTTP_TIMEOUT_MS,
  );

  if (!ocrResponse.ok) {
    throw new Error(`OCR.space responded with HTTP ${ocrResponse.status}.`);
  }

  const ocrResult = await ocrResponse.json();
  if (ocrResult.IsErroredOnProcessing) {
    throw new Error(`OCR processing failed: ${ocrResult.ErrorMessage || "unknown error"}`);
  }

  const extractedText = ocrResult.ParsedResults?.[0]?.ParsedText || "No text found in image.";
  return { text: extractedText, visionFrom: "ocr" };
}

/**
 * Understands an uploaded image. Gemini answers the prompt ("what's in this
 * image?", "describe the scene", ...); if Gemini is unavailable the request
 * degrades to plain OCR text extraction. Throws when neither is configured.
 */
export async function analyzeImage(
  buffer: Buffer,
  mimeType: string,
  prompt: string,
): Promise<VisionResult> {
  const fallbacks: Array<() => Promise<VisionResult>> = [];
  if (process.env.GEMINI_API_KEY) {
    fallbacks.push(() => analyzeWithGemini(buffer, mimeType, prompt));
  }
  if (process.env.OCR_SPACE_API_KEY) {
    fallbacks.push(() => analyzeWithOcr(buffer, mimeType));
  }
  if (fallbacks.length === 0) {
    throw new Error(
      "Vision service not configured. Set GEMINI_API_KEY (image understanding) or OCR_SPACE_API_KEY (text extraction).",
    );
  }

  let lastError: Error | null = null;
  for (const attempt of fallbacks) {
    try {
      return await attempt();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("Image analysis failed.");
}