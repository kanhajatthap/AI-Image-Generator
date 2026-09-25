export const POLLINATIONS_IMAGE_BASE = "https://image.pollinations.ai";
export const POLLINATIONS_TEXT_BASE = "https://text.pollinations.ai";

export interface ImageUrlParams {
  width?: number;
  height?: number;
  seed?: number;
  model?: string;
  nologo?: string;
  private?: boolean;
}

export function buildImageUrl(encodedPrompt: string, params: ImageUrlParams = {}): string {
  const query = new URLSearchParams();
  const numeric: Record<string, number | undefined> = {
    width: params.width,
    height: params.height,
    seed: params.seed,
  };
  for (const [key, value] of Object.entries(numeric)) {
    if (value !== undefined && value !== null) query.set(key, String(value));
  }
  if (params.model) query.set("model", params.model);
  if (params.nologo) query.set("nologo", params.nologo);
  if (params.private) query.set("private", "true");

  const qs = query.toString();
  return `${POLLINATIONS_IMAGE_BASE}/prompt/${encodedPrompt}${qs ? `?${qs}` : ""}`;
}

export class PollinationsError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "PollinationsError";
  }
}

export interface PollinationsImageResult {
  buffer: Buffer;
  mimeType: string;
}

function describeFailure(status: number, message: string, kind: "image" | "text"): { error: string; details: string; httpStatus: number } {
  const service = kind === "image" ? "image service" : "AI text service";

  if (status === 429) {
    return {
      error: `The ${service} is getting too many requests right now. Please wait a minute and try again.`,
      details: "Pollinations rate limit exceeded (429)",
      httpStatus: 429,
    };
  }
  if (status === 402) {
    return {
      error: `The ${service} could not process this request due to a service quota issue.`,
      details: "Pollinations returned 402 Payment Required",
      httpStatus: 502,
    };
  }
  if (status === 0) {
    return {
      error: `The ${service} did not respond in time. Please try again.`,
      details: `Pollinations timed out or is unreachable (${message})`,
      httpStatus: 502,
    };
  }
  if (status >= 500) {
    return {
      error: `The ${service} is busy right now and couldn't complete the request. Please wait a moment and try again.`,
      details: `Pollinations is currently failing (${status}). This is a temporary service outage, not an issue with your request.`,
      httpStatus: 502,
    };
  }
  return {
    error: `The ${service} rejected this request (HTTP ${status}). Please try a different prompt.`,
    details: `Pollinations returned ${status}`,
    httpStatus: 502,
  };
}

// Fetch from Pollinations with a per-call budget + one automatic retry.
// Throws a PollinationsError with a user-friendly message on failure.
export async function fetchPollinationsImage(url: string, budgetMs = 30000): Promise<PollinationsImageResult> {
  const deadline = Date.now() + budgetMs;
  let lastFailure: { status: number; message: string } | null = null;

  for (const attempt of [0, 1]) {
    if (Date.now() >= deadline) break;
    if (attempt > 0) await new Promise((r) => setTimeout(r, Math.min(800, deadline - Date.now())));
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remaining);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.ok) {
        const mimeType = res.headers.get("content-type") || "image/png";
        const buffer = Buffer.from(await res.arrayBuffer());
        return { buffer, mimeType };
      }
      lastFailure = {
        status: res.status,
        message: `${res.status} ${res.statusText || ""}`.trim(),
      };
    } catch (e) {
      lastFailure = {
        status: 0,
        message: e instanceof Error && e.name === "AbortError" ? "timed out" : e instanceof Error ? e.message : String(e),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  const friendly = describeFailure(lastFailure?.status ?? 0, lastFailure?.message ?? "network error", "image");
  throw new PollinationsError(friendly.error, friendly.httpStatus, friendly.details);
}

export interface PollinationsChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function fetchPollinationsText(url: string): Promise<string> {
  let lastFailure: { status: number; message: string } | null = null;

  for (const attempt of [0, 1]) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 800));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.ok) return await res.text();
      lastFailure = {
        status: res.status,
        message: `${res.status} ${res.statusText || ""}`.trim(),
      };
    } catch (e) {
      lastFailure = {
        status: 0,
        message: e instanceof Error && e.name === "AbortError" ? "timed out after 30s" : e instanceof Error ? e.message : String(e),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  const friendly = describeFailure(lastFailure?.status ?? 0, lastFailure?.message ?? "network error", "text");
  throw new PollinationsError(friendly.error, friendly.httpStatus, friendly.details);
}

// Multi-turn chat: sends the full message history so the model can answer
// follow-ups based on earlier turns. Returns plain generated text.
export async function fetchPollinationsTextFromMessages(
  messages: PollinationsChatMessage[],
  model = "openai",
): Promise<string> {
  let lastFailure: { status: number; message: string } | null = null;

  for (const attempt of [0, 1]) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 800));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${POLLINATIONS_TEXT_BASE}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages }),
        signal: controller.signal,
      });
      if (res.ok) return await res.text();
      lastFailure = {
        status: res.status,
        message: `${res.status} ${res.statusText || ""}`.trim(),
      };
    } catch (e) {
      lastFailure = {
        status: 0,
        message: e instanceof Error && e.name === "AbortError" ? "timed out after 30s" : e instanceof Error ? e.message : String(e),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  const friendly = describeFailure(lastFailure?.status ?? 0, lastFailure?.message ?? "network error", "text");
  throw new PollinationsError(friendly.error, friendly.httpStatus, friendly.details);
}

// Convert a known Pollinations HTTP status into a friendly API response object.
export function describeImageFailure(status: number): { error: string; details: string; httpStatus: number } {
  return describeFailure(status, `${status}`, "image");
}