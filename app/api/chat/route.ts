import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { getDb } from "../../../lib/mongodb";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";
import { PollinationsError } from "../../../lib/pollinations";
import { generateImageWithFallback, ProviderError } from "../../../lib/providers";
import { checkRateLimit } from "../../../lib/rateLimit";
import { markPromptSeen } from "../../../lib/bloomFilter";
import {
  generateTextWithFallback,
  generateTextStream,
  TextProviderError,
  GeneratedText,
} from "../../../lib/text";

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
  let streamRequested = false;
  let forceText = false;
  let textModel: "auto" | "gemini" | "pollinations" = "auto";

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
    streamRequested = body?.stream === true;
    forceText = body?.forceText === true;
    const rawTextModel = body?.textModel;
    textModel = rawTextModel === "gemini" || rawTextModel === "pollinations" ? rawTextModel : "auto";
    console.log("[API CHAT] Prompt from JSON:", prompt);
    console.log("[API CHAT] History messages:", discussionHistory.length);
    console.log("[API CHAT] stream:", streamRequested, "textModel:", textModel, "forceText:", forceText);
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

    // Sliding-window rate limit (see lib/rateLimit.ts)
    const rateLimit = checkRateLimit(session.userId);
    if (!rateLimit.allowed) {
      console.log("[API CHAT] Rate limited:", session.userId);
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before trying again.", retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

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

    const shouldGenerateImage = forceText ? false : isImageGenerationRequest(prompt);

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
      try {
        const { buffer, mimeType, provider } = await generateImageWithFallback({
          prompt,
          width: 1024,
          height: 1024,
          seed: Math.floor(Math.random() * 10000000),
          model: "flux",
        });
        const base64Data = buffer.toString("base64");
        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        // Save to history
        const newId = new ObjectId();
        await historyCollection.insertOne({
          _id: newId,
          userId: session.userId,
          prompt,
          model: `${provider}-image`,
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
        console.error("Image generation error:", error);
        if (error instanceof PollinationsError || error instanceof ProviderError) {
          return NextResponse.json(
            { error: error.message, details: error.details || "" },
            { status: error.status },
          );
        }
        return NextResponse.json(
          { error: "Failed to generate image. Please try again in a moment.", details: error instanceof Error ? error.message : String(error) },
          { status: 502 },
        );
      }

    } else {
      // TEXT GENERATION
      // Bloom-filter duplicate detection (approximate, only surfaces a hint).
      const duplicatePrompt = !forceText && markPromptSeen(session.userId, prompt);
      if (streamRequested) {
        const encoder = new TextEncoder();
        const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let historyIdOut = conversationId || "";
            let provider = "";
            let model = "";
            try {
              for await (const ev of generateTextStream(prompt, discussionHistory, textModel)) {
                if (ev.kind === "delta") {
                  controller.enqueue(encoder.encode(sse("delta", { text: ev.text })));
                } else if (ev.kind === "done") {
                  provider = ev.provider;
                  model = ev.model;
                  if (!forceText) {
                    const newId = new ObjectId();
                    await historyCollection.insertOne({
                      _id: newId,
                      userId: session.userId,
                      prompt,
                      model: `${provider}-text`,
                      mimeType: "text/plain",
                      generatedText: ev.text,
                      conversationId: conversationId || newId.toString(),
                      createdAt: new Date(),
                    });
                    historyIdOut = conversationId || newId.toString();
                  }
                }
              }
              controller.enqueue(encoder.encode(sse("done", { historyId: historyIdOut, provider, model, duplicate: duplicatePrompt })));
            } catch (error) {
              console.error("Text streaming error:", error);
              const mapped =
                error instanceof PollinationsError || error instanceof TextProviderError
                  ? { error: error.message, details: error.details || "", status: error.status }
                  : {
                      error: "Failed to generate the response. Please try again.",
                      details: error instanceof Error ? error.message : String(error),
                      status: 502,
                    };
              controller.enqueue(encoder.encode(sse("error", mapped)));
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      }

      let generatedText: GeneratedText;
      try {
        generatedText = await generateTextWithFallback(prompt, discussionHistory, textModel);
      } catch (error) {
        console.error("Text generation error:", error);
        if (error instanceof PollinationsError || error instanceof TextProviderError) {
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

      const cleanMessage = generatedText.text;

      // Save to history (skip tool calls like prompt-enhancement)
      const savedId = new ObjectId();
      if (!forceText) {
        await historyCollection.insertOne({
          _id: savedId,
          userId: session.userId,
          prompt,
          model: `${generatedText.provider}-text`,
          mimeType: "text/plain",
          generatedText: cleanMessage,
          conversationId: conversationId || savedId.toString(),
          createdAt: new Date(),
        });
      }

      // Return JSON response with clean text
      return NextResponse.json({
        type: "text",
        text: cleanMessage,
        provider: generatedText.provider,
        model: generatedText.model,
        duplicate: duplicatePrompt,
        historyId: conversationId || savedId.toString(),
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
