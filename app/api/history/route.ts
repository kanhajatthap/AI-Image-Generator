import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";

export const runtime = "nodejs";

async function getSessionUserId() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionToken ? await verifySessionToken(sessionToken) : null;
  return session?.userId || null;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  await db.collection("image_history").createIndex({ userId: 1, createdAt: -1 });
  const rows = await db
    .collection("image_history")
    .find(
      { userId },
      { projection: { prompt: 1, title: 1, pinned: 1, model: 1, mimeType: 1, createdAt: 1, updatedAt: 1 } },
    )
    .sort({ createdAt: -1 })
    .toArray();

  rows.sort((a: any, b: any) => {
    const ap = a?.pinned ? 1 : 0;
    const bp = b?.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    const ad = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
    const bd = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
    return bd - ad;
  });

  const items = rows.map((row) => ({
    id: String(row._id),
    prompt: row.prompt,
    title: row.title,
    pinned: !!row.pinned,
    model: row.model,
    mimeType: row.mimeType || "image/png",
    createdAt: row.createdAt,
  }));

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const imageBase64 = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "image/png";
  const model = typeof body?.model === "string" ? body.model : "unknown";

  if (!prompt || !imageBase64) {
    return NextResponse.json({ error: "Missing prompt or imageBase64." }, { status: 400 });
  }

  const db = await getDb();
  const inserted = await db.collection("image_history").insertOne({
    userId,
    prompt,
    model,
    mimeType,
    imageBase64,
    createdAt: new Date(),
  });

  return NextResponse.json({ id: String(inserted.insertedId) }, { status: 201 });
}

export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid history id." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection("image_history").deleteOne({
    _id: new ObjectId(id),
    userId,
  });

  if (!result.deletedCount) {
    return NextResponse.json({ error: "History item not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const title = typeof body?.title === "string" ? body.title.trim() : null;
  const pinned = typeof body?.pinned === "boolean" ? body.pinned : null;

  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid history id." }, { status: 400 });
  }

  if (title === null && pinned === null) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const $set: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== null) $set.title = title;
  if (pinned !== null) $set.pinned = pinned;

  const db = await getDb();
  const result = await db.collection("image_history").updateOne(
    { _id: new ObjectId(id), userId },
    { $set },
  );

  if (!result.matchedCount) {
    return NextResponse.json({ error: "History item not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
