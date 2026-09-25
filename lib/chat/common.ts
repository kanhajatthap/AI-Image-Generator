import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../session";

export const MAX_HISTORY_MESSAGES = 30;
export const MAX_HISTORY_MESSAGE_CHARS = 2000;

export type HistoryMessage = { role: "user" | "assistant"; content: string };

/**
 * Validate + cap the conversation history sent by the client so the model only
 * ever receives clean, bounded user/assistant turns.
 */
export function sanitizeHistory(raw: unknown): HistoryMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const { role, content } = rec;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    out.push({ role, content: trimmed.slice(0, MAX_HISTORY_MESSAGE_CHARS) });
    if (out.length >= MAX_HISTORY_MESSAGES) break;
  }
  return out;
}

export interface ParsedChatRequest {
  prompt: string;
  historyId: string;
  discussionHistory: HistoryMessage[];
  streamRequested: boolean;
  forceText: boolean;
  textModel: "auto" | "gemini" | "pollinations";
  uploadedImage?: { buffer: Buffer; mimeType: string };
}

/** Normalizes a POST to /api/chat (JSON or multipart, with optional image). */
export async function parseChatRequest(req: Request): Promise<ParsedChatRequest> {
  const parsed: ParsedChatRequest = {
    prompt: "",
    historyId: "",
    discussionHistory: [],
    streamRequested: false,
    forceText: false,
    textModel: "auto",
  };
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    parsed.prompt = (formData.get("prompt") as string) || "";
    parsed.historyId = (formData.get("historyId") as string) || "";
    const rawHistory = formData.get("history");
    try {
      parsed.discussionHistory = rawHistory ? sanitizeHistory(JSON.parse(String(rawHistory))) : [];
    } catch {
      parsed.discussionHistory = [];
    }
    const imageFile = formData.get("image") as File | null;
    if (imageFile) {
      const bytes = await imageFile.arrayBuffer();
      parsed.uploadedImage = {
        buffer: Buffer.from(bytes),
        mimeType: imageFile.type || "image/png",
      };
    }
  } else {
    const body = await req.json().catch(() => null);
    parsed.prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    parsed.historyId = typeof body?.historyId === "string" ? body.historyId.trim() : "";
    parsed.discussionHistory = sanitizeHistory(body?.history);
    parsed.streamRequested = body?.stream === true;
    parsed.forceText = body?.forceText === true;
    const rawTextModel = body?.textModel;
    parsed.textModel =
      rawTextModel === "gemini" || rawTextModel === "pollinations" ? rawTextModel : "auto";
  }

  return parsed;
}

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
}

/** Reads + verifies the session cookie; null when not logged in. */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = sessionToken ? await verifySessionToken(sessionToken) : null;
    if (!session?.userId) return null;
    return { userId: session.userId, email: session.email || "", name: session.name || "User" };
  } catch {
    return null;
  }
}

// Image generation detection - only for explicit image keywords. Kept strict so
// plain chat questions ("what does this design mean") don't silently switch
// into image mode.
export function isImageGenerationRequest(prompt: string): boolean {
  const imageKeywords = [
    "image", "photo", "picture", "generate image", "create image",
    "draw", "paint", "sketch", "illustration", "logo", "design",
    "poster", "vector", "icon", "art", "artwork", "render", "3d",
  ];
  const lower = prompt.toLowerCase();
  return imageKeywords.some((word) => lower.includes(word));
}

/** Resolves the conversationId this historyId belongs to (or null for a new chat). */
export async function resolveConversationId(
  db: Db,
  userId: string,
  historyId: string,
): Promise<string | null> {
  if (!historyId || !ObjectId.isValid(historyId)) return null;
  const existing = await db
    .collection("image_history")
    .findOne(
      { _id: new ObjectId(historyId), userId },
      { projection: { conversationId: 1 } },
    );
  if (!existing) return null;
  return typeof existing.conversationId === "string" && existing.conversationId
    ? existing.conversationId
    : historyId;
}