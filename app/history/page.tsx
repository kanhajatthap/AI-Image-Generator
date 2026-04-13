"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useCallback } from "react";

type HistoryItem = {
  id: string;
  prompt: string;
  model: string;
  mimeType: string;
  imageBase64: string;
  createdAt: string;
  width?: number;
  height?: number;
  seed?: number;
  style?: string;
  imageUrl?: string;
};

// Masonry grid columns based on screen size
const getColumnCount = () => {
  if (typeof window === "undefined") return 4;
  if (window.innerWidth < 640) return 2;
  if (window.innerWidth < 768) return 3;
  if (window.innerWidth < 1024) return 4;
  if (window.innerWidth < 1280) return 5;
  return 6;
};

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [columnCount, setColumnCount] = useState(4);

  const loadHistory = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/history", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          setError("Please login to view your history.");
        } else {
          setError("Failed to load history.");
        }
        return;
      }

      const json = await res.json();
      const list = Array.isArray(json?.items) ? json.items : [];
      // This page expects full image payload; fetch items individually.
      const full = await Promise.all(
        list.map(async (x: { id: string }) => {
          const r = await fetch(`/api/history/${x.id}`, { cache: "no-store" });
          if (!r.ok) return null;
          const j = await r.json();
          return j?.item || null;
        }),
      );
      setItems(full.filter(Boolean).filter((item) => item.mimeType !== "text/plain" && item.imageBase64));
    } catch {
      setError("Network error while loading history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Update column count on resize
  useEffect(() => {
    const updateColumns = () => setColumnCount(getColumnCount());
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  const deleteItem = async (id: string) => {
    const ok = window.confirm("Delete this image from history?");
    if (!ok) return;

    const res = await fetch("/api/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!res.ok) {
      alert("Failed to delete history item.");
      return;
    }

    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const copyImageUrl = async (item: HistoryItem) => {
    const url = item.imageUrl || `/api/history/${item.id}/image`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  };

  const generateSimilar = async (item: HistoryItem) => {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: item.prompt,
        width: item.width || 1024,
        height: item.height || 1024,
        seed: Math.floor(Math.random() * 1000000),
        model_type: item.model,
        style: item.style,
      }),
    });

    if (!res.ok) {
      alert("Failed to generate similar image.");
      return;
    }

    // Refresh the list
    await loadHistory();
  };

  // Distribute items into columns for masonry layout
  const distributeIntoColumns = useCallback((items: HistoryItem[], count: number) => {
    const columns: HistoryItem[][] = Array.from({ length: count }, () => []);
    items.forEach((item, index) => {
      columns[index % count].push(item);
    });
    return columns;
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Images</h1>
        </div>
        <Link href="/" className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">
          Back
        </Link>
      </div>

      {loading && <p>Loading images...</p>}
      {!loading && error && <p className="font-medium text-red-600">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-zinc-600 dark:text-zinc-400">No generated images yet.</p>
      )}

      {/* Masonry Grid Layout */}
      <div className="flex gap-4" style={{ alignItems: "flex-start" }}>
        {distributeIntoColumns(items, columnCount).map((column, colIndex) => (
          <div key={colIndex} className="flex flex-1 flex-col gap-4">
            {column.map((item) => {
              const imageSrc = item.imageUrl || `/api/history/${item.id}/image`;
              return (
                <div key={item.id} className="group relative overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <Image
                    src={imageSrc}
                    alt={item.prompt}
                    width={item.width || 1024}
                    height={item.height || 1024}
                    unoptimized
                    className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Hover Overlay with Actions */}
                  <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    {/* Prompt text */}
                    <p className="mb-3 line-clamp-2 text-xs text-white/90">
                      {item.prompt}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-1">
                      {/* Download */}
                      <a
                        href={imageSrc}
                        download={`ai-image-${item.id}.png`}
                        className="rounded bg-white/90 p-1.5 text-zinc-900 hover:bg-white dark:bg-zinc-900/90 dark:text-white dark:hover:bg-zinc-900"
                        title="Download"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </a>

                      {/* Copy URL */}
                      <button
                        onClick={() => copyImageUrl(item)}
                        className="rounded bg-white/90 p-1.5 text-zinc-900 hover:bg-white dark:bg-zinc-900/90 dark:text-white dark:hover:bg-zinc-900"
                        title="Copy URL"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>

                      {/* Generate Similar */}
                      <button
                        onClick={() => generateSimilar(item)}
                        className="rounded bg-blue-500/90 p-1.5 text-white hover:bg-blue-500"
                        title="Generate Similar"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <line x1="12" y1="8" x2="12" y2="16" />
                          <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="rounded bg-red-500/90 p-1.5 text-white hover:bg-red-500"
                        title="Delete"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </main>
  );
}
