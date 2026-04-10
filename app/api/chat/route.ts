import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "../../../lib/mongodb";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const model = typeof body?.model === "string" ? body.model.trim() : "";

  if (!prompt || !model) {
    return NextResponse.json({ error: "Missing prompt or model." }, { status: 400 });
  }

  const token =
    process.env.HUGGINGFACE_API_TOKEN ||
    process.env.HF_TOKEN ||
    process.env.HF_API_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "Missing Hugging Face token." },
      { status: 500 }
    );
  }

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = sessionToken ? await verifySessionToken(sessionToken) : null;

    if (!session?.userId) {
      return NextResponse.json({ error: "Please login to generate." }, { status: 401 });
    }

    const isImageRequest = /(generate|create image|draw|imagine)/i.test(prompt);

    if (isImageRequest) {
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
          { error: "Hugging Face image generation failed.", details: detailsText },
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
    } else {
      const textModel = "HuggingFaceH4/zephyr-7b-beta";
      const hfRes = await fetch(`https://router.huggingface.co/hf-inference/models/${textModel}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: textModel,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
        }),
      });

      if (!hfRes.ok) {
        const detailsText = await hfRes.text().catch(() => "");
        return NextResponse.json(
          { error: "Hugging Face text generation failed.", details: detailsText },
          { status: hfRes.status },
        );
      }

      const json = await hfRes.json();
      const generatedText = json.choices?.[0]?.message?.content || "No response generated.";

      const db = await getDb();
      const history = db.collection("image_history");
      await history.createIndex({ userId: 1, createdAt: -1 });
      await history.insertOne({
        userId: session.userId,
        prompt,
        model: textModel,
        mimeType: "text/plain",
        generatedText,
        createdAt: new Date(),
      });

      return NextResponse.json({ text: generatedText }, { status: 200 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: "Server error.", details: String(e) },
      { status: 500 },
    );
  }
}
