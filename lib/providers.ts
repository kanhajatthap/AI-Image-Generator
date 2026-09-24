import { buildImageUrl, PollinationsError, fetchPollinationsImage } from "./pollinations";

export interface GenerateImageOptions {
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
  model?: string;
  style?: string;
}

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
  provider: string;
  model?: string;
  url?: string;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly details?: string,
    public readonly status = 502,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

interface ImageProvider {
  name: string;
  isConfigured: () => boolean;
  generate: (opts: GenerateImageOptions) => Promise<GeneratedImage>;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Provider 1: Pollinations (free, no key required)
// ---------------------------------------------------------------------------

const POLLINATIONS_FALLBACK_MODELS = ["sana"];

async function pollinationsGenerate(opts: GenerateImageOptions): Promise<GeneratedImage> {
  const requested = opts.model && opts.model !== "default" ? opts.model : "flux";
  const candidates = Array.from(new Set([requested, "flux", ...POLLINATIONS_FALLBACK_MODELS]));

  let lastError: unknown = null;

  for (const model of candidates) {
    try {
      const url = buildImageUrl(encodeURIComponent(opts.prompt), {
        width: opts.width,
        height: opts.height,
        seed: opts.seed,
        model,
      });
      const { buffer, mimeType } = await fetchPollinationsImage(url);
      return { buffer, mimeType, provider: "pollinations", model, url };
    } catch (e) {
      lastError = e;
    }
  }

  if (lastError instanceof PollinationsError) {
    throw new ProviderError(
      lastError.message,
      "pollinations",
      lastError.details || `All pollinations models failed: ${candidates.join(", ")}`,
    );
  }
  throw new ProviderError(
    `Pollinations failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    "pollinations",
  );
}

// ---------------------------------------------------------------------------
// Provider 2: Hugging Face Inference API (free token required)
// ---------------------------------------------------------------------------

const HF_IMAGE_MODELS = [
  process.env.HF_IMAGE_MODEL,
  "black-forest-labs/FLUX.1-schnell",
  "stabilityai/stable-diffusion-xl-base-1.0",
  "runwayml/stable-diffusion-v1-5",
].filter((m): m is string => Boolean(m));

const HF_API_KEY = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;

async function huggingFaceGenerate(opts: GenerateImageOptions): Promise<GeneratedImage> {
  const candidates = Array.from(new Set(HF_IMAGE_MODELS));
  let lastError: unknown = null;

  for (const model of candidates) {
    try {
      const res = await fetchWithTimeout(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: opts.prompt,
            parameters: {
              ...(opts.width ? { width: opts.width } : {}),
              ...(opts.height ? { height: opts.height } : {}),
              ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
            },
          }),
        },
        60000,
      );

      const contentType = res.headers.get("content-type") || "";
      const buffer = Buffer.from(await res.arrayBuffer());

      if (!res.ok || contentType.includes("application/json")) {
        let msg = `HTTP ${res.status}`;
        try {
          const json = JSON.parse(buffer.toString("utf-8"));
          if (json?.error) msg = String(json.error);
        } catch {
          // ignore JSON parse errors, keep fallback message
        }
        throw new Error(msg);
      }

      return { buffer, mimeType: contentType || "image/png", provider: "huggingface", model };
    } catch (e) {
      lastError = e;
    }
  }

  throw new ProviderError(
    "Hugging Face image generation failed.",
    "huggingface",
    lastError instanceof Error ? lastError.message : String(lastError),
  );
}

// ---------------------------------------------------------------------------
// Provider 3: Google Gemini (native image generation, free API key required)
// ---------------------------------------------------------------------------

const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

async function geminiGenerate(opts: GenerateImageOptions): Promise<GeneratedImage> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ProviderError("Google Gemini image generation failed.", "gemini", "GEMINI_API_KEY not set.");
  }
  const model = GEMINI_IMAGE_MODEL;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      },
      90000,
    );

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const message = typeof json?.error?.message === "string" ? json.error.message : `HTTP ${res.status}`;
      throw new Error(message);
    }

    const parts: Array<{ inlineData?: { data?: string; mimeType?: string } }> | undefined = json?.candidates?.[0]?.content?.parts;
    const inline = Array.isArray(parts) ? parts.find((p) => p?.inlineData?.data) : undefined;

    if (!inline?.inlineData?.data) {
      throw new Error("Gemini returned no image data.");
    }

    const mimeType = typeof inline.inlineData.mimeType === "string" ? inline.inlineData.mimeType : "image/png";
    return { buffer: Buffer.from(inline.inlineData.data, "base64"), mimeType, provider: "gemini", model };
  } catch (e) {
    throw new ProviderError(
      "Google Gemini image generation failed.",
      "gemini",
      e instanceof Error ? e.message : String(e),
    );
  }
}

// ---------------------------------------------------------------------------
// Provider 4: Together AI (free API key required, OpenAI-compatible)
// ---------------------------------------------------------------------------

const TOGETHER_IMAGE_MODELS = [
  process.env.TOGETHER_IMAGE_MODEL,
  "FLUX.1-schnell-Free",
  "stabilityai/stable-diffusion-xl-base-1.0",
].filter((m): m is string => Boolean(m));

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;

async function togetherGenerate(opts: GenerateImageOptions): Promise<GeneratedImage> {
  const candidates = Array.from(new Set(TOGETHER_IMAGE_MODELS));
  let lastError: unknown = null;

  for (const model of candidates) {
    try {
      const size = `${opts.width || 1024}x${opts.height || 1024}`;
      const res = await fetchWithTimeout(
        "https://api.together.xyz/v1/images/generations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${TOGETHER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            prompt: opts.prompt,
            n: 1,
            size,
            ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
          }),
        },
        90000,
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const message =
          typeof json?.error?.message === "string"
            ? json.error.message
            : typeof json?.error === "string"
              ? json.error
              : `HTTP ${res.status}`;
        throw new Error(message);
      }

      const item = json?.data?.[0];
      if (!item) {
        throw new Error("Together returned no image data.");
      }

      if (item.b64_json) {
        return { buffer: Buffer.from(item.b64_json, "base64"), mimeType: "image/png", provider: "together", model };
      }
      if (typeof item.url === "string" && item.url) {
        const imgRes = await fetchWithTimeout(item.url, {}, 60000);
        if (!imgRes.ok) throw new Error(`Failed to download image from Together (HTTP ${imgRes.status})`);
        const contentType = imgRes.headers.get("content-type") || "image/png";
        return { buffer: Buffer.from(await imgRes.arrayBuffer()), mimeType: contentType, provider: "together", model };
      }
      throw new Error("Together response had no image URL or base64 data.");
    } catch (e) {
      lastError = e;
    }
  }

  throw new ProviderError(
    "Together AI image generation failed.",
    "together",
    lastError instanceof Error ? lastError.message : String(lastError),
  );
}

// ---------------------------------------------------------------------------
// Provider registry + failover
// ---------------------------------------------------------------------------

const providers: ImageProvider[] = [
  { name: "pollinations", isConfigured: () => true, generate: pollinationsGenerate },
  {
    name: "huggingface",
    isConfigured: () => Boolean(HF_API_KEY),
    generate: huggingFaceGenerate,
  },
  {
    name: "gemini",
    isConfigured: () => Boolean(process.env.GEMINI_API_KEY),
    generate: geminiGenerate,
  },
  {
    name: "together",
    isConfigured: () => Boolean(TOGETHER_API_KEY),
    generate: togetherGenerate,
  },
];

export function getConfiguredProviders(): string[] {
  return providers.filter((p) => p.isConfigured()).map((p) => p.name);
}

export async function generateImageWithFallback(opts: GenerateImageOptions): Promise<GeneratedImage> {
  const errors: string[] = [];

  for (const provider of providers) {
    if (!provider.isConfigured()) continue;
    try {
      const image = await provider.generate(opts);
      console.info(`[providers] Generated image via ${image.provider}${image.model ? ` (${image.model})` : ""}`);
      return image;
    } catch (e) {
      const message =
        e instanceof ProviderError
          ? e.details || e.message
          : e instanceof Error
            ? e.message
            : String(e);
      console.warn(`[providers] ${provider.name} failed: ${message}`);
      errors.push(`${provider.name}: ${message}`);
    }
  }

  throw new ProviderError(
    "All image providers failed. Please try again in a moment.",
    "all",
    errors.join(" | "),
    502,
  );
}