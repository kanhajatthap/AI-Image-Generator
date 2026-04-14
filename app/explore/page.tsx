"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useCallback } from "react";

type ExploreItem = {
  id: string;
  prompt: string;
  model: string;
  mimeType: string;
  seed?: number;
  width?: number;
  height?: number;
  createdAt: string;
};

type SortOption = "latest" | "popular" | "random";

// Masonry grid columns based on screen size
const getColumnCount = () => {
  if (typeof window === "undefined") return 4;
  if (window.innerWidth < 640) return 2;
  if (window.innerWidth < 768) return 3;
  if (window.innerWidth < 1024) return 4;
  if (window.innerWidth < 1280) return 5;
  return 6;
};

export default function ExplorePage() {
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortOption>("latest");
  const [columnCount, setColumnCount] = useState(4);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadGallery = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/explore?sort=${sort}&limit=50`, { cache: "no-store" });
      if (!res.ok) {
        setError("Failed to load gallery.");
        return;
      }
      const json = await res.json();
      const list = Array.isArray(json?.items) ? json.items : [];
      setItems(list);
    } catch {
      setError("Network error while loading gallery.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGallery();
  }, [sort]);

  // Update column count on resize
  useEffect(() => {
    const updateColumns = () => setColumnCount(getColumnCount());
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  const copyPrompt = async (item: ExploreItem) => {
    try {
      await navigator.clipboard.writeText(item.prompt);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  // Distribute items into columns for masonry layout
  const distributeIntoColumns = useCallback((items: ExploreItem[], count: number) => {
    const columns: ExploreItem[][] = Array.from({ length: count }, () => []);
    items.forEach((item, index) => {
      columns[index % count].push(item);
    });
    return columns;
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Explore</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Discover AI-generated images from the community
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Back to Generator
        </Link>
      </div>

      {/* Sort Options */}
      <div className="mb-6 flex items-center gap-2">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">Sort by:</span>
        <div className="flex gap-1">
          {(["latest", "popular", "random"] as SortOption[]).map((option) => (
            <button
              key={option}
              onClick={() => setSort(option)}
              className={[
                "rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                sort === option
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                  : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900",
              ].join(" ")}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/30">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={loadGallery}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="text-zinc-600 dark:text-zinc-400">No images in the gallery yet.</p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
            Be the first to generate and share!
          </p>
        </div>
      )}

      {/* Masonry Grid */}
      {!loading && !error && items.length > 0 && (
        <div className="flex gap-4" style={{ alignItems: "flex-start" }}>
          {distributeIntoColumns(items, columnCount).map((column, colIndex) => (
            <div key={colIndex} className="flex flex-1 flex-col gap-4">
              {column.map((item) => {
                const imageSrc = `/api/history/${item.id}/image`;
                return (
                  <div
                    key={item.id}
                    className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    {/* Image Container */}
                    <div className="relative overflow-hidden">
                      <Image
                        src={imageSrc}
                        alt={item.prompt}
                        width={item.width || 1024}
                        height={item.height || 1024}
                        loading="lazy"
                        unoptimized
                        className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        {/* Top: Date */}
                        <div className="flex justify-start p-2">
                          <span className="rounded-full bg-black/50 px-2 py-1 text-[10px] text-white/90 backdrop-blur-sm">
                            {formatDate(item.createdAt)}
                          </span>
                        </div>

                        {/* Bottom: Action Buttons */}
                        <div className="flex items-center justify-between gap-2 p-3">
                          {/* Copy Prompt */}
                          <button
                            onClick={() => copyPrompt(item)}
                            className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-900 backdrop-blur-sm transition-colors hover:bg-white"
                            title="Copy prompt"
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            {copiedId === item.id ? "Copied!" : "Copy Prompt"}
                          </button>

                          {/* Download */}
                          <a
                            href={imageSrc}
                            download={`explore-${item.id}.png`}
                            className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-900 backdrop-blur-sm transition-colors hover:bg-white"
                            title="Download image"
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Prompt */}
                    <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
                      <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                        {item.prompt}
                      </p>
                      {item.seed !== undefined && (
                        <p className="mt-1 text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                          Seed: {item.seed}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
