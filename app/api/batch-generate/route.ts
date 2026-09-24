import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { getDb } from "../../../lib/mongodb";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";
import { PollinationsError } from "../../../lib/pollinations";
import { generateImageWithFallback, ProviderError } from "../../../lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const count = Math.min(Math.max(parseInt(body?.count || "4", 10), 1), 8);
  const width = typeof body?.width === "number" ? body.width : 1024;
  const height = typeof body?.height === "number" ? body.height : 1024;
  const model = typeof body?.model === "string" ? body.model : "flux";
  const style = typeof body?.style === "string" ? body.style : undefined;
  const historyId = typeof body?.historyId === "string" ? body.historyId.trim() : "";

  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = sessionToken ? await verifySessionToken(sessionToken) : null;

    if (!session?.userId) {
      return NextResponse.json({ error: "Please login to generate." }, { status: 401 });
    }

    const stylePrompt = style && style !== "none" ? `${prompt}, ${style} style, highly detailed` : prompt;

    const generateOne = async (seed: number) => {
      const { buffer, mimeType } = await generateImageWithFallback({
        prompt: stylePrompt,
        width,
        height,
        seed,
        model,
        style,
      });
      return { buffer, mimeType, seed };
    };

    const seeds = Array.from({ length: count }, () => Math.floor(Math.random() * 10000000));
    const results = await Promise.all(seeds.map((seed) => generateOne(seed)));

    const db = await getDb();
    const history = db.collection("image_history");

    // Resolve the conversation id so follow-up batches stay in the same chat.
    let conversationId: string | null = null;
    if (historyId && ObjectId.isValid(historyId)) {
      const existing = await history.findOne(
        { _id: new ObjectId(historyId), userId: session.userId },
        { projection: { conversationId: 1 } },
      );
      if (existing) {
        conversationId =
          typeof existing.conversationId === "string" && existing.conversationId
            ? existing.conversationId
            : historyId;
      }
    }

    const imageBase64 = results[0].buffer.toString("base64");
    const newId = new ObjectId();
    await history.insertOne({
      _id: newId,
      userId: session.userId,
      prompt,
      model: `batch-${model}`,
      mimeType: results[0].mimeType,
      imageBase64,
      seed: results[0].seed,
      width,
      height,
      style,
      public: true,
      type: "batch",
      conversationId: conversationId || newId.toString(),
      batchResults: results.map((r) => ({
        seed: r.seed,
        imageBase64: r.buffer.toString("base64"),
        mimeType: r.mimeType,
      })),
      messages: [
        { role: "user", content: `Batch generate: ${prompt} (${count} images)`, createdAt: new Date() },
        { role: "assistant", content: `Generated ${count} images`, createdAt: new Date() },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      type: "batch",
      historyId: conversationId || newId.toString(),
      images: results.map((r, i) => ({
        id: `${newId}-${i}`,
        url: `/api/history/${newId}/image${i > 0 ? `?n=${i}` : ""}`,
        seed: r.seed,
      })),
    }, { status: 200 });
  } catch (e) {
    console.error("Batch generation error:", e);
    if (e instanceof PollinationsError || e instanceof ProviderError) {
      return NextResponse.json(
        { error: e.message, details: e.details || "" },
        { status: e.status },
      );
    }
    return NextResponse.json(
      { error: "Batch generation failed. Please try again in a moment.", details: String(e) },
      { status: 502 },
    );
  }
}
