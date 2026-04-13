import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

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
    const encodedPrompt = encodePrompt(prompt);

    if (shouldGenerateImage) {
      // Generate image using Pollinations AI
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;

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
      await history.insertOne({
        userId: session.userId,
        prompt,
        model: "pollinations-image",
        mimeType: contentType,
        imageBase64: buffer.toString("base64"),
        createdAt: new Date(),
      });

      // Return JSON response with image type
      return NextResponse.json({
        type: "image",
        url: imageUrl,
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
      await history.insertOne({
        userId: session.userId,
        prompt,
        model: "pollinations-text",
        mimeType: "text/plain",
        generatedText,
        createdAt: new Date(),
      });

      // Return JSON response with text type
      return NextResponse.json({
        type: "text",
        text: generatedText,
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
