import { NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") || "latest";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  try {
    const db = await getDb();
    await db.collection("image_history").createIndex({ createdAt: -1 });

    // Build query - only images with actual image data
    const query = {
      mimeType: { $ne: "text/plain" },
      imageBase64: { $exists: true },
    };

    // Build sort based on parameter
    let sortOption: any = {};
    switch (sort) {
      case "popular":
        // For now, use createdAt as proxy for popularity
        // In future, could add viewCount or likeCount field
        sortOption = { createdAt: -1 };
        break;
      case "random":
        // Random sampling will be done differently
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
      .limit(limit)
      .toArray();

    // Handle random sorting in memory if requested
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

    return NextResponse.json({ items }, { status: 200 });
  } catch (e) {
    console.error("Explore API error:", e);
    return NextResponse.json(
      { error: "Failed to load gallery." },
      { status: 500 }
    );
  }
}
