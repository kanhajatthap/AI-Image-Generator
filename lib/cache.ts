const imageCache = new Map<string, { data: string; mimeType: string; timestamp: number }>();

const CACHE_TTL = 30 * 60 * 1000;

function getCacheKey(prompt: string, width?: number, height?: number, seed?: number, model?: string, style?: string): string {
  return `${prompt}|${width || 1024}|${height || 1024}|${seed || 0}|${model || "flux"}|${style || ""}`;
}

export function getCachedImage(prompt: string, width?: number, height?: number, seed?: number, model?: string, style?: string): { data: string; mimeType: string } | null {
  const key = getCacheKey(prompt, width, height, seed, model, style);
  const entry = imageCache.get(key);

  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL) {
    imageCache.delete(key);
    return null;
  }

  return { data: entry.data, mimeType: entry.mimeType };
}

export function setCachedImage(prompt: string, data: string, mimeType: string, width?: number, height?: number, seed?: number, model?: string, style?: string): void {
  const key = getCacheKey(prompt, width, height, seed, model, style);
  imageCache.set(key, { data, mimeType, timestamp: Date.now() });

  if (imageCache.size > 200) {
    const oldest = imageCache.keys().next().value;
    if (oldest) imageCache.delete(oldest);
  }
}
