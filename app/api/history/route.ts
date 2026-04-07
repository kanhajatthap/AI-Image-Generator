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
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();

  const items = rows.map((row) => ({
    id: String(row._id),
    prompt: row.prompt,
    model: row.model,
    mimeType: row.mimeType || "image/png",
    imageBase64: row.imageBase64,
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
