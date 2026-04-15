import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "../../../lib/mongodb";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxBodyLength = 50 * 1024 * 1024; // 50MB for image uploads

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
  console.log("[API CHAT] Route called");
  
  // Detect content type
  const contentType = req.headers.get("content-type") || "";
  console.log("[API CHAT] Content-Type:", contentType);

  let prompt = "";
  let uploadedImageBase64: string | null = null;
  let imageMimeType = "image/png";

  // Handle FormData (image upload)
  if (contentType.includes("multipart/form-data")) {
    console.log("[API CHAT] Processing FormData request");
    try {
      const formData = await req.formData();
      prompt = (formData.get("prompt") as string) || "";
      const imageFile = formData.get("image") as File | null;
      console.log("[API CHAT] Prompt:", prompt);
      console.log("[API CHAT] Image file:", imageFile ? `${imageFile.name} (${imageFile.size} bytes, ${imageFile.type})` : "none");

      if (imageFile) {
        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        uploadedImageBase64 = buffer.toString("base64");
        imageMimeType = imageFile.type || "image/png";
        console.log("[API CHAT] Image converted to base64, size:", uploadedImageBase64.length, "characters");
      }
    } catch (e) {
      console.error("[API CHAT] FormData parse error:", e);
      return NextResponse.json({ success: false, error: "Invalid form data." }, { status: 400 });
    }
  } else {
    // Handle JSON (text only)
    console.log("[API CHAT] Processing JSON request");
    const body = await req.json().catch(() => null);
    prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    console.log("[API CHAT] Prompt from JSON:", prompt);
  }

  if (!prompt && !uploadedImageBase64) {
    console.log("[API CHAT] Validation failed: missing prompt or image");
    return NextResponse.json({ success: false, error: "Missing prompt or image." }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = sessionToken ? await verifySessionToken(sessionToken) : null;

    if (!session?.userId) {
      console.log("[API CHAT] Auth failed: no session");
      return NextResponse.json({ success: false, error: "Please login to generate." }, { status: 401 });
    }
    console.log("[API CHAT] Auth success for user:", session.userId);

    const shouldGenerateImage = isImageGenerationRequest(prompt);
    const encodedPrompt = encodePrompt(prompt);

    // VISION: Handle image analysis using OCR.space
    if (uploadedImageBase64) {
      console.log("[API CHAT] Starting OCR analysis");
      try {
        const apiKey = process.env.OCR_SPACE_API_KEY;
        console.log("[API CHAT] OCR_SPACE_API_KEY present:", !!apiKey);
        if (!apiKey) {
          console.log("[API CHAT] OCR service not configured");
          return NextResponse.json(
            { success: false, error: "OCR service not configured. Missing OCR_SPACE_API_KEY." },
            { status: 500 }
          );
        }

        const visionPrompt = prompt || "Extract all text from this image.";
        console.log("[API CHAT] Sending to OCR.space with prompt:", visionPrompt);
        console.log("[API CHAT] Image data size:", uploadedImageBase64.length, "characters, mime:", imageMimeType);

        // Call OCR.space API
        const formData = new FormData();
        formData.append("base64Image", `data:${imageMimeType};base64,${uploadedImageBase64}`);
        formData.append("language", "eng");
        formData.append("isOverlayRequired", "false");
        formData.append("scale", "true");
        formData.append("detectOrientation", "true");
        formData.append("apikey", apiKey);

        const ocrResponse = await fetch("https://api.ocr.space/parse/image", {
          method: "POST",
          body: formData,
        });

        console.log("[API CHAT] OCR.space response status:", ocrResponse.status);

        if (!ocrResponse.ok) {
          const errorText = await ocrResponse.text();
          console.error("[API CHAT] OCR.space error:", errorText);
          return NextResponse.json(
            { success: false, error: "OCR service failed.", details: errorText },
            { status: ocrResponse.status }
          );
        }

        const ocrResult = await ocrResponse.json();
        console.log("[API CHAT] OCR.space result:", ocrResult);

        if (ocrResult.IsErroredOnProcessing) {
          console.error("[API CHAT] OCR.space processing error:", ocrResult.ErrorMessage);
          return NextResponse.json(
            { success: false, error: "OCR processing failed.", details: ocrResult.ErrorMessage },
            { status: 500 }
          );
        }

        const extractedText = ocrResult.ParsedResults?.[0]?.ParsedText || "No text found in image.";
        console.log("[API CHAT] Text extracted, length:", extractedText.length);

        // Save vision chat to history
        const db = await getDb();
        const history = db.collection("image_history");
        await history.createIndex({ userId: 1, createdAt: -1 });
        await history.insertOne({
          userId: session.userId,
          type: "vision",
          imageBase64: uploadedImageBase64,
          mimeType: imageMimeType,
          prompt: visionPrompt,
          response: extractedText,
          createdAt: new Date(),
        });
        console.log("[API CHAT] Vision chat saved to history");

        return NextResponse.json({
          success: true,
          type: "vision",
          text: extractedText,
          uploadedImageUrl: `data:${imageMimeType};base64,${uploadedImageBase64}`,
          prompt: visionPrompt,
        }, { status: 200 });
      } catch (error: any) {
        console.error("[API CHAT] OCR API error:", error);
        console.error("[API CHAT] Error stack:", error?.stack);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to analyze image.",
            details: error?.message || String(error)
          },
          { status: 500 }
        );
      }
    }

    // IMAGE GENERATION
    if (shouldGenerateImage) {
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${Date.now()}`;

      try {
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
      // TEXT GENERATION
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

  } catch (e: any) {
    console.error("[API CHAT] Unhandled error:", e);
    console.error("[API CHAT] Error stack:", e?.stack);
    return NextResponse.json(
      { success: false, error: "Server error.", details: String(e) },
      { status: 500 },
    );
  }
}
