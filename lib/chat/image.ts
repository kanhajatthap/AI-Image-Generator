import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { NextResponse } from "next/server";
import { generateImageWithFallback, ProviderError } from "../providers";
import { PollinationsError } from "../pollinations";
import { QuotaExceededError, spendQuota } from "../quota";
import { quotaErrorResponse } from "../httpError";
import type { SessionUser } from "./common";

/**
 * Generates a single image for a chat turn. Charges one image credit before
 * hitting any provider so the free-tier cap actually protects the API bills.
 */
export async function handleImageTurn(
  db: Db,
  user: SessionUser,
  prompt: string,
  conversationId: string | null,
): Promise<Response> {
  try {
    await spendQuota(db, user.userId, "image", 1);
  } catch (e) {
    if (e instanceof QuotaExceededError) return quotaErrorResponse(e);
    throw e;
  }

  try {
    const { buffer, mimeType, provider } = await generateImageWithFallback({
      prompt,
      width: 1024,
      height: 1024,
      seed: Math.floor(Math.random() * 10000000),
      model: "flux",
    });
    const base64Data = buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    const newId = new ObjectId();
    await db.collection("image_history").insertOne({
      _id: newId,
      userId: user.userId,
      prompt,
      model: `${provider}-image`,
      type: "image",
      imageBase64: base64Data,
      mimeType,
      public: true,
      conversationId: conversationId || newId.toString(),
      createdAt: new Date(),
    });

    return NextResponse.json({
      type: "image",
      url: dataUrl,
      historyId: conversationId || newId.toString(),
    }, { status: 200 });
  } catch (error) {
    console.error("Image generation error:", error);
    if (error instanceof PollinationsError || error instanceof ProviderError) {
      return NextResponse.json(
        { error: error.message, details: error.details || "" },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "Failed to generate image. Please try again in a moment.", details: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}