import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../lib/mongodb";
import { checkRateLimit } from "../../../lib/rateLimit";
import {
  getSessionUser,
  isImageGenerationRequest,
  parseChatRequest,
  resolveConversationId,
} from "../../../lib/chat/common";
import { handleTextTurn } from "../../../lib/chat/text";
import { handleImageTurn } from "../../../lib/chat/image";
import { handleVisionTurn } from "../../../lib/chat/vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxBodyLength = 15 * 1024 * 1024; // 15MB for image uploads

/**
 * Multiplexing entry point for the in-app chat.
 *
 * The heavy logic lives in focused modules (`lib/chat/*`) which are also
 * exposed directly as `/api/text` and `/api/vision`. This route only decides
 * which mode the message is:
 *   1. uploaded image + "similar/variation" words  -> variations
 *   2. uploaded image                              -> vision (understand it)
 *   3. prompt with image keywords                  -> image generation
 *   4. anything else                               -> text chat
 */
export async function POST(req: Request) {
  let parsed;
  try {
    parsed = await parseChatRequest(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: "Invalid request.", details: msg }, { status: 400 });
  }

  if (!parsed.prompt && !parsed.uploadedImage) {
    return NextResponse.json({ success: false, error: "Missing prompt or image." }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Please login to generate." }, { status: 401 });
  }

  const rateLimit = checkRateLimit(user.userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before trying again.", retryAfter: rateLimit.retryAfter },
      { status: 429 },
    );
  }

  try {
    const db = await getDb();
    const conversationId = await resolveConversationId(db, user.userId, parsed.historyId);
    const prompt = parsed.prompt;
    const uploadedImage = parsed.uploadedImage;

    // Variation request — take an uploaded image and produce similar images.
    const isSimilarRequest = /\b(similar|variation|variations|like this|similar to this)\b/i.test(prompt);
    if (uploadedImage && isSimilarRequest) {
      const cleanPrompt =
        prompt.replace(/\b(similar|variation|variations|like this|similar to this)\b/gi, "").trim() ||
        "similar image";

      const newId = new ObjectId();
      await db.collection("image_history").insertOne({
        _id: newId,
        userId: user.userId,
        prompt: cleanPrompt,
        type: "image",
        imageBase64: uploadedImage.buffer.toString("base64"),
        mimeType: uploadedImage.mimeType || "image/png",
        conversationId: conversationId || newId.toString(),
        createdAt: new Date(),
      });

      const historyId = conversationId || newId.toString();
      const imageUrl = `/api/history/${newId}/image`;

      const variationsRes = await fetch(new URL("/api/variations", req.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalImageUrl: imageUrl,
          prompt: cleanPrompt,
          count: 4,
          userId: user.userId,
        }),
      });

      if (!variationsRes.ok) {
        console.error("[chat] Variations API failed");
        return NextResponse.json({ success: false, error: "Failed to generate similar images." }, { status: 500 });
      }

      const variationsJson = await variationsRes.json();
      return NextResponse.json(
        {
          success: true,
          type: "variations",
          variations: variationsJson.variations || [],
          historyId,
          prompt: cleanPrompt,
          message: "Generated similar images",
        },
        { status: 200 },
      );
    }

    // Vision: an image is attached (with or without a question).
    if (uploadedImage) {
      return await handleVisionTurn(db, user, prompt, uploadedImage.buffer, uploadedImage.mimeType, conversationId);
    }

    // Image generation.
    if (!parsed.forceText && isImageGenerationRequest(prompt)) {
      return await handleImageTurn(db, user, prompt, conversationId);
    }

    // Everything else is a text conversation.
    return await handleTextTurn(db, user, parsed);
  } catch (e) {
    console.error("[chat] Unhandled error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: "Server error.", details: msg }, { status: 500 });
  }
}