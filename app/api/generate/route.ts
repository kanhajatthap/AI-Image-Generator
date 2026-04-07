import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "../../../lib/mongodb";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const model = typeof body?.model === "string" ? body.model.trim() : "";

  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
  }

  if (!model) {
    return NextResponse.json({ error: "Missing model." }, { status: 400 });
  }

  const token =
    process.env.HUGGINGFACE_API_TOKEN ||
    process.env.HF_TOKEN ||
    process.env.HF_API_TOKEN;

  if (!token) {
    return NextResponse.json(
      {
        error:
          "Missing Hugging Face token. Set HUGGINGFACE_API_TOKEN (or HF_TOKEN) in .env.local.",
      },
      { status: 500 },
    );
  }

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = sessionToken ? await verifySessionToken(sessionToken) : null;

    if (!session?.userId) {
      return NextResponse.json({ error: "Please login to generate and save history." }, { status: 401 });
    }

    const hfRes = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "image/png",
      },
      body: JSON.stringify({
        inputs: prompt,
        options: { wait_for_model: true },
      }),
    });

    if (!hfRes.ok) {
      const detailsText = await hfRes.text().catch(() => "");
      return NextResponse.json(
        {
          error: "Hugging Face generation failed.",
          details: detailsText || `${hfRes.status} ${hfRes.statusText}`,
        },
        { status: hfRes.status },
      );
    }

    const contentType = hfRes.headers.get("content-type") || "image/png";
    const bytes = await hfRes.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const db = await getDb();
    const history = db.collection("image_history");
    await history.createIndex({ userId: 1, createdAt: -1 });
    await history.insertOne({
      userId: session.userId,
      prompt,
      model,
      mimeType: contentType,
      imageBase64: buffer.toString("base64"),
      createdAt: new Date(),
    });

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Server error while generating image.", details: String(e) },
      { status: 500 },
    );
  }
}