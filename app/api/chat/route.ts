import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "../../../lib/mongodb";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Image generation detection - only for explicit image keywords
function isImageGenerationRequest(prompt: string): boolean {
  const imageKeywords = [
    "image","photo","picture","generate image","create image",
    "draw","paint","sketch","illustration","logo","design",
    "poster","vector","icon","art","artwork","render","3d"
  ];

  const lower = prompt.toLowerCase();

  return imageKeywords.some(word => lower.includes(word));
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

    const shouldGenerateImage = isImageGenerationRequest(prompt);
    const encodedPrompt = encodePrompt(prompt);

    if (shouldGenerateImage) {
      // Generate image using Pollinations AI
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${Date.now()}`;

      try {
        // Fetch the image from Pollinations
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

        // Convert to base64 data URL
        const base64Data = buffer.toString("base64");
        const dataUrl = `data:${contentType};base64,${base64Data}`;

        // Save to history
        const db = await getDb();
        const history = db.collection("image_history");
        await history.createIndex({ userId: 1, createdAt: -1 });
        await history.insertOne({
          userId: session.userId,
          prompt,
          type: "image",
          imageBase64: base64Data,
          mimeType: contentType,
          createdAt: new Date(),
        });

        return NextResponse.json({
          type: "image",
          url: dataUrl
        }, { status: 200 });
      } catch (error) {
        console.error("Image fetch error:", error);
        return NextResponse.json(
          { error: "Failed to fetch image from Pollinations." },
          { status: 500 }
        );
      }

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

      const responseText = await textRes.text();

      // Parse response - handle both plain text and JSON formats
      let cleanMessage = responseText;
      try {
        const parsed = JSON.parse(responseText);
        // Extract message from various possible response formats
        if (typeof parsed === "string") {
          cleanMessage = parsed;
        } else if (parsed.message && typeof parsed.message === "string") {
          cleanMessage = parsed.message;
        } else if (parsed.content && typeof parsed.content === "string") {
          cleanMessage = parsed.content;
        } else if (parsed.text && typeof parsed.text === "string") {
          cleanMessage = parsed.text;
        } else if (parsed.response && typeof parsed.response === "string") {
          cleanMessage = parsed.response;
        } else if (parsed.choices && parsed.choices[0]?.message?.content) {
          cleanMessage = parsed.choices[0].message.content;
        } else if (parsed.choices && parsed.choices[0]?.text) {
          cleanMessage = parsed.choices[0].text;
        }
      } catch {
        // Not JSON, use as-is (it's already plain text)
      }

      // Trim and clean up
      cleanMessage = cleanMessage.trim();

      // Save to history
      const db = await getDb();
      const history = db.collection("image_history");
      await history.createIndex({ userId: 1, createdAt: -1 });
      await history.insertOne({
        userId: session.userId,
        prompt,
        model: "pollinations-text",
        mimeType: "text/plain",
        generatedText: cleanMessage,
        createdAt: new Date(),
      });

      // Return JSON response with clean text
      return NextResponse.json({
        type: "text",
        text: cleanMessage,
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
