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
  
  // Return all history items (images, text, and vision)
  type HistoryRow = {
    _id: import("mongodb").ObjectId;
    prompt?: string;
    title?: string;
    pinned?: boolean;
    model?: string;
    mimeType?: string;
    createdAt?: Date;
    updatedAt?: Date;
    imageBase64?: string;
    conversationId?: string;
    type?: string;
    generatedText?: string;
  };

  const rows = (await db
    .collection("image_history")
    .find(
      { userId },
      { projection: { prompt: 1, title: 1, pinned: 1, model: 1, mimeType: 1, createdAt: 1, updatedAt: 1, imageBase64: 1, type: 1, generatedText: 1, conversationId: 1 } },
    )
    .sort({ createdAt: -1 })
    .toArray()) as HistoryRow[];

  const items = rows.map((row) => ({
    id: String(row._id),
    prompt: row.prompt,
    title: row.title,
    pinned: !!row.pinned,
    model: row.model,
    mimeType: row.mimeType || "image/png",
    imageBase64: row.imageBase64,
    createdAt: row.createdAt,
  }));

  // Group the raw documents into conversations. Every history doc stores a
  // `conversationId` that points to the first message of its chat; legacy docs
  // (no field) are their own conversation with the id being their own _id.
  type ConversationAcc = {
    title?: string;
    pinned?: boolean;
    model?: string;
    mimeType?: string;
    type?: string;
    prompt?: string;
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
  };
  const convMap = new Map<string, ConversationAcc>();

  for (const row of rows) {
    const key = String(row.conversationId || row._id);
    const created = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt || 0);
    const hasUpdated = row.updatedAt instanceof Date ? row.updatedAt : created;

    const prev = convMap.get(key);
    if (!prev) {
      convMap.set(key, {
        title: row.title,
        pinned: !!row.pinned,
        model: row.model,
        mimeType: row.mimeType,
        type: row.type,
        prompt: row.prompt,
        createdAt: created,
        updatedAt: hasUpdated,
        messageCount: 1,
      });
      continue;
    }

    prev.createdAt = created.getTime() < prev.createdAt.getTime() ? created : prev.createdAt;
    prev.messageCount += 1;
    if (created.getTime() >= prev.updatedAt.getTime()) {
      prev.updatedAt = created;
      prev.prompt = row.prompt;
      prev.model = row.model;
      prev.mimeType = row.mimeType;
      prev.type = row.type;
    }
  }

  const conversations = Array.from(convMap.entries()).map(([cid, c]) => ({
    id: cid,
    prompt: c.prompt || "Untitled",
    ...(c.title ? { title: c.title } : {}),
    pinned: !!c.pinned,
    model: c.model,
    mimeType: c.mimeType || "image/png",
    type: c.type,
    messageCount: c.messageCount,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  conversations.sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return NextResponse.json({ items, conversations }, { status: 200 });
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
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
  const id = typeof body?.id === "string" ? body.id : "";

  const db = await getDb();
  const collection = db.collection("image_history");

  // Deleting a conversation removes its first message and every follow-up turn.
  if (conversationId) {
    if (!conversationId || !ObjectId.isValid(conversationId)) {
      return NextResponse.json({ error: "Invalid conversation id." }, { status: 400 });
    }

    const result = await collection.deleteMany({
      userId,
      $or: [{ _id: new ObjectId(conversationId) }, { conversationId }],
    });

    if (!result.deletedCount) {
      return NextResponse.json({ error: "History item not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  }

  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid history id." }, { status: 400 });
  }

  const result = await collection.deleteOne({
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
