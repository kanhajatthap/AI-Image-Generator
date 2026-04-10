import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";

export const runtime = "nodejs";

async function getSessionUserId() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionToken ? await verifySessionToken(sessionToken) : null;
  return session?.userId || null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const db = await getDb();
  const row = await db.collection("image_history").findOne({
    _id: new ObjectId(id),
    userId,
  });

  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json(
    {
      item: {
        id: String(row._id),
        prompt: row.prompt,
        model: row.model,
        mimeType: row.mimeType || "image/png",
        imageBase64: row.imageBase64,
        generatedText: row.generatedText,
        createdAt: row.createdAt,
      },
    },
    { status: 200 },
  );
}

