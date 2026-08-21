import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { getDb } from "../../../lib/mongodb";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BatchRequest {
  prompt: string;
  count: number;
  width?: number;
  height?: number;
  model?: string;
  style?: string;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const count = Math.min(Math.max(parseInt(body?.count || "4", 10), 1), 8);
  const width = typeof body?.width === "number" ? body.width : 1024;
  const height = typeof body?.height === "number" ? body.height : 1024;
  const model = typeof body?.model === "string" ? body.model : "flux";
  const style = typeof body?.style === "string" ? body.style : undefined;

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
    const encodedPrompt = encodeURIComponent(stylePrompt);

    const generateOne = async (seed: number) => {
      const params = new URLSearchParams({
        width: String(width),
        height: String(height),
        seed: String(seed),
        model,
      });
      const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed for seed ${seed}`);
      const bytes = await res.arrayBuffer();
      return { buffer: Buffer.from(bytes), mimeType: res.headers.get("content-type") || "image/png", seed, url };
    };

    const seeds = Array.from({ length: count }, () => Math.floor(Math.random() * 10000000));
    const results = await Promise.all(seeds.map((seed) => generateOne(seed)));

    const db = await getDb();
    const history = db.collection("image_history");

    const imageBase64 = results[0].buffer.toString("base64");
    const result = await history.insertOne({
      userId: session.userId,
      prompt,
      model: `batch-${model}`,
      mimeType: results[0].mimeType,
      imageBase64,
      seed: results[0].seed,
      width,
      height,
      style,
      type: "batch",
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
      historyId: result.insertedId.toString(),
      images: results.map((r, i) => ({
        id: `${result.insertedId}-${i}`,
        url: `/api/history/${result.insertedId}/image`,
        seed: r.seed,
      })),
    }, { status: 200 });
  } catch (e) {
    console.error("Batch generation error:", e);
    return NextResponse.json({ error: "Server error.", details: String(e) }, { status: 500 });
  }
}
