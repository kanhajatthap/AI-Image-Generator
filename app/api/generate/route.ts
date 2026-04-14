import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { getDb } from "../../../lib/mongodb";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Helper to check if prompt is asking for an image
function isImagePrompt(prompt: string): boolean {
  const imageKeywords = /\b(image|photo|picture|generate|create|draw|paint|sketch|illustration)\b/i;
  return imageKeywords.test(prompt);
}

// Helper to encode prompt for URL
function encodePrompt(prompt: string): string {
  return encodeURIComponent(prompt);
}

// Helper to enhance prompt with style
function enhancePromptWithStyle(prompt: string, style?: string): string {
  if (!style || style === "none") return prompt;
  return `${prompt}, ${style} style, highly detailed, cinematic lighting`;
}

// Image settings interface
interface ImageSettings {
  width?: number;
  height?: number;
  seed?: number;
  model?: string;
  style?: string;
  enhance?: boolean;
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "The Generate API is active and functioning! Send a POST request with { prompt } to generate text or images using Pollinations AI."
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch((e) => {
    console.error("JSON parse error:", e);
    return null;
  });

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const historyId = typeof body?.historyId === "string" ? body.historyId.trim() : null;

  // Extract image settings from request
  const settings: ImageSettings = {
    width: typeof body?.width === "number" ? body.width : undefined,
    height: typeof body?.height === "number" ? body.height : undefined,
    seed: typeof body?.seed === "number" ? body.seed : Math.floor(Math.random() * 10000000),
    model: typeof body?.model_type === "string" ? body.model_type : (typeof body?.model === "string" ? body.model : "flux"),
    style: typeof body?.style === "string" ? body.style : undefined,
    enhance: typeof body?.enhance === "boolean" ? body.enhance : false,
  };

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

    const shouldGenerateImage = isImagePrompt(prompt);

    // Apply style enhancement if provided
    const finalPrompt = settings.style ? enhancePromptWithStyle(prompt, settings.style) : prompt;
    const encodedPrompt = encodePrompt(finalPrompt);

    if (shouldGenerateImage) {
      // Build image URL with query parameters
      const queryParams = new URLSearchParams();
      if (settings.width) queryParams.set("width", settings.width.toString());
      if (settings.height) queryParams.set("height", settings.height.toString());
      if (settings.seed !== undefined) queryParams.set("seed", settings.seed.toString());
      if (settings.model) queryParams.set("model", settings.model);

      const queryString = queryParams.toString();
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}${queryString ? `?${queryString}` : ""}`;

      // Fetch the image
      const imageRes = await fetch(imageUrl);

      if (!imageRes.ok) {
        return NextResponse.json(
          { error: "Image generation failed.", details: `Pollinations returned ${imageRes.status}` },
          { status: imageRes.status }
        );
      }

      const contentType = imageRes.headers.get("content-type") || "image/png";
      const bytes = await imageRes.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Save to history
      const db = await getDb();
      const history = db.collection("image_history");
      await history.createIndex({ userId: 1, createdAt: -1 });

      let resultHistoryId: string | null = null;

      if (historyId && ObjectId.isValid(historyId)) {
        // Continue existing conversation
        await history.updateOne(
          { _id: new ObjectId(historyId), userId: session.userId },
          {
            $push: {
              messages: {
                $each: [
                  { role: "user", content: prompt, createdAt: new Date() },
                  { role: "assistant", content: "Image generated", imageBase64: buffer.toString("base64"), createdAt: new Date() },
                ],
              },
            } as unknown as any,
            $set: {
              imageBase64: buffer.toString("base64"),
              mimeType: contentType,
              seed: settings.seed,
              updatedAt: new Date()
            },
          }
        );
        resultHistoryId = historyId;
      } else {
        // Create new conversation
        const result = await history.insertOne({
          userId: session.userId,
          prompt,
          model: "pollinations-image",
          mimeType: contentType,
          imageBase64: buffer.toString("base64"),
          seed: settings.seed,
          messages: [
            { role: "user", content: prompt, createdAt: new Date() },
            { role: "assistant", content: "Image generated", imageBase64: buffer.toString("base64"), createdAt: new Date() },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        resultHistoryId = result.insertedId.toString();
      }

      // Return JSON response with image type and settings
      return NextResponse.json({
        type: "image",
        url: imageUrl,
        historyId: resultHistoryId,
        settings: {
          width: settings.width,
          height: settings.height,
          seed: settings.seed,
          model: settings.model,
          style: settings.style,
        }
      }, { status: 200 });

    } else {
      // Generate text using Pollinations AI
      const textUrl = `https://text.pollinations.ai/${encodedPrompt}`;

      const textRes = await fetch(textUrl);

      if (!textRes.ok) {
        return NextResponse.json(
          { error: "Text generation failed.", details: `Pollinations returned ${textRes.status}` },
          { status: textRes.status }
        );
      }

      const generatedText = await textRes.text();

      // Save to history
      const db = await getDb();
      const history = db.collection("image_history");
      await history.createIndex({ userId: 1, createdAt: -1 });

      let resultHistoryId: string | null = null;

      if (historyId && ObjectId.isValid(historyId)) {
        // Continue existing conversation
        await history.updateOne(
          { _id: new ObjectId(historyId), userId: session.userId },
          {
            $push: {
              messages: {
                $each: [
                  { role: "user", content: prompt, createdAt: new Date() },
                  { role: "assistant", content: generatedText, createdAt: new Date() },
                ],
              },
            } as unknown as any,
            $set: { updatedAt: new Date() },
          }
        );
        resultHistoryId = historyId;
      } else {
        // Create new conversation
        const result = await history.insertOne({
          userId: session.userId,
          prompt,
          model: "pollinations-text",
          mimeType: "text/plain",
          generatedText,
          messages: [
            { role: "user", content: prompt, createdAt: new Date() },
            { role: "assistant", content: generatedText, createdAt: new Date() },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        resultHistoryId = result.insertedId.toString();
      }

      // Return JSON response with text type
      return NextResponse.json({
        type: "text",
        text: generatedText,
        historyId: resultHistoryId
      }, { status: 200 });
    }

  } catch (e) {
    console.error("Pollinations API error:", e);
    return NextResponse.json(
      { error: "Server error.", details: String(e) },
      { status: 500 },
    );
  }
}