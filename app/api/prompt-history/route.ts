import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionToken ? await verifySessionToken(sessionToken) : null;

  if (!session?.userId) {
    return NextResponse.json({ prompts: [] }, { status: 200 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 20);

  const db = await getDb();
  const collection = db.collection("image_history");

  const match: any = { userId: session.userId };
  if (q) {
    match.prompt = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  }

  const rows = await collection
    .aggregate([
      { $match: match },
      { $group: { _id: "$prompt", lastUsed: { $max: "$createdAt" } } },
      { $sort: { lastUsed: -1 } },
      { $limit: limit },
      { $project: { _id: 0, prompt: "$_id", lastUsed: 1 } },
    ])
    .toArray();

  return NextResponse.json({ prompts: rows.map((r: any) => r.prompt) }, { status: 200 });
}
