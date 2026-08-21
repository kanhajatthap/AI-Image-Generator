import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") || "latest";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const q = searchParams.get("q") || "";
  const skip = (page - 1) * limit;

  try {
    const db = await getDb();
    await db.collection("image_history").createIndex({ createdAt: -1 });
    await db.collection("image_history").createIndex({ prompt: "text" });

    const query: any = {
      mimeType: { $ne: "text/plain" },
      imageBase64: { $exists: true },
    };

    if (q) {
      query.prompt = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }

    let sortOption: any = {};
    switch (sort) {
      case "popular":
        sortOption = { createdAt: -1 };
        break;
      case "random":
        sortOption = { createdAt: -1 };
        break;
      case "latest":
      default:
        sortOption = { createdAt: -1 };
        break;
    }

    const rows = await db
      .collection("image_history")
      .find(query, {
        projection: {
          prompt: 1,
          model: 1,
          mimeType: 1,
          seed: 1,
          width: 1,
          height: 1,
          createdAt: 1,
        },
      })
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .toArray();

    let results = rows;
    if (sort === "random") {
      results = [...rows].sort(() => Math.random() - 0.5);
    }

    const items = results.map((row) => ({
      id: String(row._id),
      prompt: row.prompt,
      model: row.model || "flux",
      mimeType: row.mimeType || "image/png",
      seed: row.seed,
      width: row.width,
      height: row.height,
      createdAt: row.createdAt,
    }));

    return NextResponse.json({ items, page, hasMore: items.length === limit }, { status: 200 });
  } catch (e) {
    console.error("Explore API error:", e);
    return NextResponse.json(
      { error: "Failed to load gallery." },
      { status: 500 }
    );
  }
}
