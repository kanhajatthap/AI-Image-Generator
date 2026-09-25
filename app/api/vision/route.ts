import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { checkRateLimit } from "../../../lib/rateLimit";
import { handleVisionTurn } from "../../../lib/chat/vision";
import { getSessionUser, resolveConversationId } from "../../../lib/chat/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dedicated vision endpoint: uploads an image (single file + optional prompt)
 * and gets an AI description / answer / extracted text. Uses one chat credit.
 */
export async function POST(req: Request) {
  const formData = await req.formData();
  const prompt = (formData.get("prompt") as string) || "";
  const historyId = (formData.get("historyId") as string) || "";
  const imageFile = formData.get("image") as File | null;

  if (!imageFile) {
    return NextResponse.json({ error: "Missing image." }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Please login to generate." }, { status: 401 });
  }

  const rateLimit = checkRateLimit(user.userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before trying again.", retryAfter: rateLimit.retryAfter },
      { status: 429 },
    );
  }

  const bytes = await imageFile.arrayBuffer();
  const db = await getDb();
  const conversationId = await resolveConversationId(db, user.userId, historyId);

  return handleVisionTurn(
    db,
    user,
    prompt.trim(),
    Buffer.from(bytes),
    imageFile.type || "image/png",
    conversationId,
  );
}