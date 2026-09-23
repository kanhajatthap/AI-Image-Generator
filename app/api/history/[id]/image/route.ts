import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/mongodb";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../../lib/session";

export const runtime = "nodejs";

async function getSessionUserId() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionToken ? await verifySessionToken(sessionToken) : null;
  return session?.userId || null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();

  const { id } = await ctx.params;
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const db = await getDb();
  const row = await db.collection("image_history").findOne(
    { _id: new ObjectId(id) },
    { projection: { imageBase64: 1, mimeType: 1, userId: 1, public: 1 } },
  );

  // Images are viewable when they belong to the viewer, are explicitly public,
  // or are legacy records (created before the public flag existed). Private
  // images (public === false) are only viewable by their owner.
  const viewable = Boolean(userId && row?.userId === userId) || row?.public !== false;
  if (!row?.imageBase64 || !viewable) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const bytes = Buffer.from(row.imageBase64, "base64");
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": row.mimeType || "image/png",
      "Cache-Control": "no-store",
    },
  });
}

