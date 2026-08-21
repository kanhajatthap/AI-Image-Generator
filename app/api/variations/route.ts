import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "../../../lib/mongodb";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch((e) => {
    console.error("JSON parse error:", e);
    return null;
  });

  const originalImageUrl = typeof body?.originalImageUrl === "string" ? body.originalImageUrl : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const width = typeof body?.width === "number" ? body.width : 1024;
  const height = typeof body?.height === "number" ? body.height : 1024;
  const model = typeof body?.model === "string" ? body.model : "flux";
  const style = typeof body?.style === "string" ? body.style : undefined;
  const variationCount = Math.min(Math.max(typeof body?.count === "number" ? body.count : 4), 6);

  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
  }

  try {
    // Check for userId in body (for server-to-server calls) or session cookie
    const bodyUserId = typeof body?.userId === "string" ? body.userId : null;
    
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = sessionToken ? await verifySessionToken(sessionToken) : null;

    const userId = bodyUserId || session?.userId;
    
    if (!userId) {
      return NextResponse.json({ error: "Please login to generate variations." }, { status: 401 });
    }

    // Build prompt for variations - include reference to original style
    const variationPrompt = style 
      ? `${prompt}, ${style} style, variation`
      : `${prompt}, similar style and composition, variation`;

    const encodedPrompt = encodeURIComponent(variationPrompt);

    // Generate multiple variations with different seeds
    const variations = [];
    const baseSeed = Date.now();

    for (let i = 0; i < variationCount; i++) {
      const seed = baseSeed + i * 1000 + Math.floor(Math.random() * 100);
      
      const queryParams = new URLSearchParams();
      queryParams.set("width", width.toString());
      queryParams.set("height", height.toString());
      queryParams.set("seed", seed.toString());
      queryParams.set("model", model);
      queryParams.set("nologo", "true");
      queryParams.set("private", "true");

      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?${queryParams.toString()}`;
      
      variations.push({
        id: `var-${Date.now()}-${i}`,
        url: imageUrl,
        seed,
        prompt: variationPrompt,
      });
    }

    // Optionally save the original to history if not already saved
    const db = await getDb();
    const history = db.collection("image_history");

    return NextResponse.json({
      success: true,
      variations,
      originalPrompt: prompt,
    }, { status: 200 });

  } catch (error) {
    console.error("Variations generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate variations." },
      { status: 500 }
    );
  }
}
