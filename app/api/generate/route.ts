import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "../../../lib/mongodb";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "The Generate API is active and functioning! However, you must send a POST request with a { prompt } to generate an image or text."
  });
}

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
      // Use the correct HF Router URL: https://router.huggingface.co/v1/chat/completions
      // Model goes in the request body, NOT in the URL path.
      const TEXT_MODELS = [
        "deepseek-ai/DeepSeek-R1",
        "meta-llama/Llama-3.3-70B-Instruct",
        "Qwen/Qwen2.5-72B-Instruct",
        "mistralai/Mistral-7B-Instruct-v0.3",
      ];

      const HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";

      let generatedText = "Sorry, I couldn't generate a response.";
      let usedModel = TEXT_MODELS[0];
      let success = false;

      const chatBody = (modelId: string) =>
        JSON.stringify({
          model: modelId,
          messages: [
            {
              role: "system",
              content: "You are a helpful AI assistant. Answer clearly and concisely.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 500,
        });

      for (const modelId of TEXT_MODELS) {
        let hfRes: Response;
        try {
          hfRes = await fetch(HF_ROUTER_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: chatBody(modelId),
          });
        } catch {
          console.warn(`Fetch failed for model ${modelId}, skipping.`);
          continue;
        }

        if (hfRes.ok) {
          const jsonResponse = await hfRes.json();
          const choice = jsonResponse?.choices?.[0];
          if (choice?.message?.content) {
            generatedText = choice.message.content.trim();
            usedModel = modelId;
            success = true;
            break;
          }
        } else {
          const detailsText = await hfRes.text().catch(() => "");
          console.warn(`Model ${modelId} returned ${hfRes.status}: ${detailsText}`);
          if (hfRes.status === 429) {
            return NextResponse.json(
              { error: "Rate limit reached. Please try again in a moment." },
              { status: 429 }
            );
          }
          // 400 / 401 / 403 = auth or config issue — stop trying, no point
          if (hfRes.status === 400 || hfRes.status === 401 || hfRes.status === 403) {
            return NextResponse.json(
              { error: "Hugging Face authentication failed. Check your API token.", details: detailsText },
              { status: hfRes.status }
            );
          }
          // 404 / 410 / 503 → model unavailable on this provider, try next
        }
      }

      if (!success) {
        return NextResponse.json(
          { error: "All text generation models are currently unavailable. Please try again later." },
          { status: 503 }
        );
      }

      const textDb = await getDb();
      const textHistory = textDb.collection("image_history");
      await textHistory.createIndex({ userId: 1, createdAt: -1 });
      await textHistory.insertOne({
        userId: session.userId,
        prompt,
        model: usedModel,
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