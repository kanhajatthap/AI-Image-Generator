"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

type HistoryItem = {
  id: string;
  prompt: string;
  model: string;
  mimeType: string;
  imageBase64: string;
  createdAt: string;
};

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((item) => {
          const imageSrc = `/api/history/${item.id}/image`;
          return (
            <div key={item.id} className="group relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <Image
                src={imageSrc}
                alt=""
                width={512}
                height={512}
                unoptimized
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <a
                  href={imageSrc}
                  download={`ai-image-${item.id}.png`}
                  className="rounded-full bg-white/90 p-2 text-zinc-900 hover:bg-white dark:bg-zinc-900/90 dark:text-white dark:hover:bg-zinc-900"
                  title="Download"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </a>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="rounded-full bg-white/90 p-2 text-red-600 hover:bg-white dark:bg-zinc-900/90 dark:text-red-400 dark:hover:bg-zinc-900"
                  title="Delete"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M6 6l1 16h10l1-16" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
