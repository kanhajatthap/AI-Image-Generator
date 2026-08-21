"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useCallback, useRef } from "react";
import { MasonrySkeleton } from "../../components/Skeleton";

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

const getColumnCount = () => {
  if (typeof window === "undefined") return 4;
  if (window.innerWidth < 640) return 2;
  if (window.innerWidth < 768) return 3;
  if (window.innerWidth < 1024) return 4;
  if (window.innerWidth < 1280) return 5;
  return 6;
};

const PAGE_SIZE = 20;

export default function ExplorePage() {
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortOption>("latest");
  const [columnCount, setColumnCount] = useState(4);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      pageRef.current = 1;
      setHasMore(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadGallery = async (page: number, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ sort, limit: String(PAGE_SIZE), page: String(page) });
      if (debouncedQuery) params.set("q", debouncedQuery);
      const res = await fetch(`/api/explore?${params}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Failed to load gallery.");
        return;
      }
      const json = await res.json();
      const list: ExploreItem[] = Array.isArray(json?.items) ? json.items : [];
      if (append) {
        setItems((prev) => [...prev, ...list]);
      } else {
        setItems(list);
      }
      setHasMore(list.length >= PAGE_SIZE);
      pageRef.current = page + 1;
    } catch {
      setError("Network error while loading gallery.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    pageRef.current = 1;
    loadGallery(1, false);
  }, [sort, debouncedQuery]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    if (!sentinelRef.current || !hasMore || loading || loadingMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadGallery(pageRef.current, true);
        }
      },
      { rootMargin: "200px" }
    );

    observerRef.current.observe(sentinelRef.current);

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, loading, loadingMore, items.length]);

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
    } catch {}
  };

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
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 sm:mb-8">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 sm:text-2xl">Explore Gallery</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
            Discover AI-generated images from the community
          </p>
        </div>
        <Link
          href="/"
          className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30 sm:px-5 sm:py-2.5"
        >
          Back to Generator
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompts..."
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-white/60 p-1 shadow-sm ring-1 ring-gray-100 backdrop-blur-sm dark:bg-zinc-900/60 dark:ring-zinc-800">
          <span className="px-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:px-3 sm:text-sm">Sort by:</span>
          <div className="flex gap-1">
            {(["latest", "popular", "random"] as SortOption[]).map((option) => (
              <button
                key={option}
                onClick={() => setSort(option)}
                className={[
                  "rounded-lg px-2 py-1.5 text-xs font-medium capitalize transition-colors sm:px-3 sm:text-sm",
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
      </div>

      {loading && <MasonrySkeleton columns={columnCount} />}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/30">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => loadGallery(1, false)}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700 sm:p-12">
          <p className="text-zinc-600 dark:text-zinc-400">
            {debouncedQuery ? "No images match your search." : "No images in the gallery yet."}
          </p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
            {debouncedQuery ? "Try a different search term." : "Be the first to generate and share!"}
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="flex gap-3 sm:gap-4" style={{ alignItems: "flex-start" }}>
          {distributeIntoColumns(items, columnCount).map((column, colIndex) => (
            <div key={colIndex} className="flex flex-1 flex-col gap-3 sm:gap-4">
              {column.map((item) => {
                const imageSrc = `/api/history/${item.id}/image`;
                return (
                  <div
                    key={item.id}
                    className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                  >
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
                      <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <div className="flex justify-start p-2">
                          <span className="rounded-full bg-black/50 px-2 py-1 text-[10px] text-white/90 backdrop-blur-sm">
                            {formatDate(item.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 p-3">
                          <button
                            onClick={() => copyPrompt(item)}
                            className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-900 backdrop-blur-sm transition-colors hover:bg-white"
                            title="Copy prompt"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            {copiedId === item.id ? "Copied!" : "Copy Prompt"}
                          </button>
                          <a
                            href={imageSrc}
                            download={`explore-${item.id}.png`}
                            className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-900 backdrop-blur-sm transition-colors hover:bg-white"
                            title="Download image"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download
                          </a>
                        </div>
                      </div>
                    </div>
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

      {hasMore && !loading && !error && <div ref={sentinelRef} className="h-4" />}

      {loadingMore && (
        <div className="flex items-center justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
          <span className="ml-2 text-sm text-zinc-500">Loading more...</span>
        </div>
      )}
    </main>
  );
}
