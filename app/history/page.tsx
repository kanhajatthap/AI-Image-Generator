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
      setItems(full.filter(Boolean));
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
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Image History</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Your generated images are saved on the server.
          </p>
        </div>
        <Link href="/" className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">
          Back
        </Link>
      </div>

      {loading && <p>Loading history...</p>}
      {!loading && error && <p className="font-medium text-red-600">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-zinc-600 dark:text-zinc-400">No generated images yet.</p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const imageSrc = `/api/history/${item.id}/image`;
          const created = new Date(item.createdAt).toLocaleString();
          return (
            <article key={item.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <Image
                src={imageSrc}
                alt={item.prompt}
                width={512}
                height={512}
                unoptimized
                className="h-52 w-full rounded object-cover"
              />
              <p className="mt-3 line-clamp-3 text-sm font-medium">{item.prompt}</p>
              <p className="mt-2 text-xs text-zinc-500">{created}</p>
              <div className="mt-4 flex gap-2">
                <a
                  href={imageSrc}
                  download={`ai-image-${item.id}.png`}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Download
                </a>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-950/40"
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
