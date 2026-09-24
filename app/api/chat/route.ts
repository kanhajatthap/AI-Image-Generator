import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { getDb } from "../../../lib/mongodb";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";
import { buildImageUrl, PollinationsError, fetchPollinationsImage, fetchPollinationsText, fetchPollinationsTextFromMessages } from "../../../lib/pollinations";

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

type HistoryMessage = { role: "user" | "assistant"; content: string };

const MAX_HISTORY_MESSAGES = 30;
const MAX_HISTORY_MESSAGE_CHARS = 2000;

// Validate + cap the conversation history sent by the client so the model
// only ever receives clean, bounded user/assistant turns.
function sanitizeHistory(raw: unknown): HistoryMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const { role, content } = rec;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    out.push({ role, content: trimmed.slice(0, MAX_HISTORY_MESSAGE_CHARS) });
    if (out.length >= MAX_HISTORY_MESSAGES) break;
  }
  return out;
}


export async function POST(req: Request) {
  console.log("[API CHAT] Route called");
  
  // Detect content type
  const contentType = req.headers.get("content-type") || "";
  console.log("[API CHAT] Content-Type:", contentType);

  let prompt = "";
  let uploadedImageBase64: string | null = null;
  let imageMimeType = "image/png";
  let discussionHistory: HistoryMessage[] = [];
  let historyId = "";

  // Handle FormData (image upload)
  if (contentType.includes("multipart/form-data")) {
    console.log("[API CHAT] Processing FormData request");
    try {
      const formData = await req.formData();
      prompt = (formData.get("prompt") as string) || "";
      historyId = (formData.get("historyId") as string) || "";
      const rawHistory = formData.get("history");
      try {
        discussionHistory = rawHistory ? sanitizeHistory(JSON.parse(String(rawHistory))) : [];
      } catch {
        discussionHistory = [];
      }
      const imageFile = formData.get("image") as File | null;
      console.log("[API CHAT] Prompt:", prompt);
      console.log("[API CHAT] History messages:", discussionHistory.length);
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
    historyId = typeof body?.historyId === "string" ? body.historyId.trim() : "";
    discussionHistory = sanitizeHistory(body?.history);
    console.log("[API CHAT] Prompt from JSON:", prompt);
    console.log("[API CHAT] History messages:", discussionHistory.length);
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

    const db = await getDb();
    const historyCollection = db.collection("image_history");
    await historyCollection.createIndex({ userId: 1, createdAt: -1 });

    // Resolve the conversation this turn belongs to. When no (valid) historyId
    // is sent the turn starts a brand new conversation.
    let conversationId: string | null = null;
    if (historyId && ObjectId.isValid(historyId)) {
      const existing = await historyCollection.findOne(
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

    const shouldGenerateImage = isImageGenerationRequest(prompt);
    const encodedPrompt = encodePrompt(prompt);

    // Check if prompt is asking for similar images - redirect to variations API
    const isSimilarRequest = /\b(similar|variation|variations|like this|similar to this)\b/i.test(prompt);
    
    if (uploadedImageBase64 && isSimilarRequest) {
      console.log("[API CHAT] Similar/variation request detected, generating variations");
      try {
        const cleanPrompt = prompt.replace(/\b(similar|variation|variations|like this|similar to this)\b/gi, "").trim() || "similar image";
        
        const newId = new ObjectId();
        await historyCollection.insertOne({
          _id: newId,
          userId: session.userId,
          prompt: cleanPrompt,
          type: "image",
          imageBase64: uploadedImageBase64,
          mimeType: imageMimeType || "image/png",
          conversationId: conversationId || newId.toString(),
          createdAt: new Date(),
        });
        
        const historyId = conversationId || newId.toString();
        const imageUrl = `/api/history/${newId}/image`;
        
        // Now call variations API
        const variationsRes = await fetch(new URL("/api/variations", req.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalImageUrl: imageUrl,
            prompt: cleanPrompt,
            count: 4,
            userId: session.userId,
          }),
        });

        if (!variationsRes.ok) {
          console.log("[API CHAT] Variations API failed");
          return NextResponse.json({ success: false, error: "Failed to generate similar images." }, { status: 500 });
        }

        const variationsJson = await variationsRes.json();
        console.log("[API CHAT] Variations generated:", variationsJson.variations?.length || 0);
        
        return NextResponse.json({
          success: true,
          type: "variations",
          variations: variationsJson.variations || [],
          historyId,
          prompt: cleanPrompt,
          message: "Generated similar images",
        }, { status: 200 });
      } catch (variationError) {
        console.error("[API CHAT] Variations error:", variationError);
        return NextResponse.json({ success: false, error: "Failed to generate similar images." }, { status: 500 });
      }
    }

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
        const newId = new ObjectId();
        await historyCollection.insertOne({
          _id: newId,
          userId: session.userId,
          type: "vision",
          imageBase64: uploadedImageBase64,
          mimeType: imageMimeType,
          prompt: visionPrompt,
          response: extractedText,
          conversationId: conversationId || newId.toString(),
          createdAt: new Date(),
        });
        console.log("[API CHAT] Vision chat saved to history");

        return NextResponse.json({
          success: true,
          type: "vision",
          text: extractedText,
          uploadedImageUrl: `data:${imageMimeType};base64,${uploadedImageBase64}`,
          prompt: visionPrompt,
          historyId: conversationId || newId.toString(),
        }, { status: 200 });
      } catch (error: unknown) {
        console.error("[API CHAT] OCR API error:", error);
        const msg = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        console.error("[API CHAT] Error stack:", stack);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to analyze image.",
            details: msg
          },
          { status: 500 }
        );
      }
    }

    // IMAGE GENERATION
    if (shouldGenerateImage) {
      const imageUrl = buildImageUrl(encodeURIComponent(prompt), { width: 1024, height: 1024, seed: Date.now() });

      try {
        const { buffer, mimeType } = await fetchPollinationsImage(imageUrl);
        const base64Data = buffer.toString("base64");
        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        // Save to history
        const newId = new ObjectId();
        await historyCollection.insertOne({
          _id: newId,
          userId: session.userId,
          prompt,
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
        console.error("Image fetch error:", error);
        if (error instanceof PollinationsError) {
          return NextResponse.json(
            { error: error.message, details: error.details || "" },
            { status: error.status },
          );
        }
        return NextResponse.json(
          { error: "Failed to fetch image. Please try again in a moment.", details: error instanceof Error ? error.message : String(error) },
          { status: 502 },
        );
      }

    } else {
      // TEXT GENERATION
      let responseText: string;
      try {
        if (discussionHistory.length > 0) {
          // Send the full conversation so follow-up questions are answered
          // using context from earlier turns instead of in isolation.
          const messages = [
            {
              role: "system" as const,
              content: "You are a helpful assistant. Use the conversation history below to understand the full context, then answer the user's latest message naturally. If the latest message refers to something mentioned earlier, respond based on that context.",
            },
            ...discussionHistory,
            { role: "user" as const, content: prompt },
          ];
          responseText = await fetchPollinationsTextFromMessages(messages, "openai");
        } else {
          const textUrl = `https://text.pollinations.ai/${encodedPrompt}`;
          responseText = await fetchPollinationsText(textUrl);
        }
      } catch (error) {
        console.error("Text fetch error:", error);
        if (error instanceof PollinationsError) {
          return NextResponse.json(
            { error: error.message, details: error.details || "" },
            { status: error.status },
          );
        }
        return NextResponse.json(
          { error: "Failed to fetch text response. Please try again.", details: error instanceof Error ? error.message : String(error) },
          { status: 502 },
        );
      }

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
      const newId = new ObjectId();
      await historyCollection.insertOne({
        _id: newId,
        userId: session.userId,
        prompt,
        model: "pollinations-text",
        mimeType: "text/plain",
        generatedText: cleanMessage,
        conversationId: conversationId || newId.toString(),
        createdAt: new Date(),
      });

      // Return JSON response with clean text
      return NextResponse.json({
        type: "text",
        text: cleanMessage,
        historyId: conversationId || newId.toString(),
      }, { status: 200 });
    }

  } catch (e: unknown) {
    console.error("[API CHAT] Unhandled error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[API CHAT] Error stack:", stack);
    return NextResponse.json(
      { success: false, error: "Server error.", details: msg },
      { status: 500 },
    );
  }
}
