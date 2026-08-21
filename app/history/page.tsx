"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useCallback, useRef } from "react";
import { MasonrySkeleton } from "../../components/Skeleton";

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

const getColumnCount = () => {
  if (typeof window === "undefined") return 4;
  if (window.innerWidth < 640) return 2;
  if (window.innerWidth < 768) return 3;
  if (window.innerWidth < 1024) return 4;
  if (window.innerWidth < 1280) return 5;
  return 6;
};

type Variation = {
  id: string;
  url: string;
  seed: number;
  prompt: string;
};

const PAGE_SIZE = 20;

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [columnCount, setColumnCount] = useState(4);
  const [variationsModal, setVariationsModal] = useState<{ item: HistoryItem; variations: Variation[]; loading: boolean } | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const allItemsRef = useRef<HistoryItem[]>([]);
  const pageRef = useRef(1);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const loadHistory = async (page: number, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
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
      const allList: HistoryItem[] = Array.isArray(json?.items) ? json.items : [];
      allItemsRef.current = allList;

      const start = (page - 1) * PAGE_SIZE;
      const pageItems = allList.slice(start, start + PAGE_SIZE);

      if (append) {
        setItems((prev) => [...prev, ...pageItems]);
      } else {
        setItems(pageItems);
      }
      setHasMore(start + PAGE_SIZE < allList.length);
      pageRef.current = page + 1;
    } catch {
      setError("Network error while loading history.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    pageRef.current = 1;
    loadHistory(1, false);
  }, []);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    if (!sentinelRef.current || !hasMore || loading || loadingMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadHistory(pageRef.current, true);
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
    allItemsRef.current = allItemsRef.current.filter((x) => x.id !== id);
  };

  const copyImageUrl = async (item: HistoryItem) => {
    const url = item.imageUrl || `/api/history/${item.id}/image`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
  };

  const generateSimilar = async (item: HistoryItem) => {
    setVariationsModal({ item, variations: [], loading: true });

    try {
      const imageUrl = item.imageUrl || `/api/history/${item.id}/image`;
      const res = await fetch("/api/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalImageUrl: imageUrl,
          prompt: item.prompt,
          width: item.width || 1024,
          height: item.height || 1024,
          model: item.model || "flux",
          style: item.style,
          count: 4,
        }),
      });

      if (!res.ok) {
        alert("Failed to generate similar images.");
        setVariationsModal(null);
        return;
      }

      const json = await res.json();
      setVariationsModal({ item, variations: json.variations || [], loading: false });
    } catch (error) {
      console.error("Similar images error:", error);
      alert("Failed to generate similar images.");
      setVariationsModal(null);
    }
  };

  const regenerate = async (item: HistoryItem) => {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: item.prompt,
        width: item.width || 1024,
        height: item.height || 1024,
        seed: item.seed,
        model_type: item.model,
        style: item.style,
      }),
    });

    if (!res.ok) {
      alert("Failed to regenerate image.");
      return;
    }

    await loadHistory(1, false);
  };

  const createVariations = async (item: HistoryItem) => {
    setVariationsModal({ item, variations: [], loading: true });

    try {
      const imageUrl = item.imageUrl || `/api/history/${item.id}/image`;
      const res = await fetch("/api/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalImageUrl: imageUrl,
          prompt: item.prompt,
          width: item.width || 1024,
          height: item.height || 1024,
          model: item.model || "flux",
          style: item.style,
          count: 4,
        }),
      });

      if (!res.ok) {
        alert("Failed to generate variations.");
        setVariationsModal(null);
        return;
      }

      const json = await res.json();
      setVariationsModal({ item, variations: json.variations || [], loading: false });
    } catch (error) {
      console.error("Variations error:", error);
      alert("Failed to generate variations.");
      setVariationsModal(null);
    }
  };

  const distributeIntoColumns = useCallback((items: HistoryItem[], count: number) => {
    const columns: HistoryItem[][] = Array.from({ length: count }, () => []);
    items.forEach((item, index) => {
      columns[index % count].push(item);
    });
    return columns;
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 flex items-center justify-between sm:mb-8">
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 sm:text-2xl">Generated Images</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">Your AI-generated image collection</p>
        </div>
        <div className="flex gap-2">
          <Link href="/explore" className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-zinc-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 sm:px-4 sm:text-sm">
            Explore
          </Link>
          <Link href="/" className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-2 text-xs font-medium text-white shadow-md shadow-indigo-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30 sm:px-4 sm:text-sm">
            Back to Chat
          </Link>
        </div>
      </div>

      {loading && <MasonrySkeleton columns={columnCount} />}

      {!loading && error && <p className="font-medium text-red-600">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 p-8 text-center shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-16">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 shadow-inner dark:from-indigo-950/30 dark:to-purple-950/30 sm:h-20 sm:w-20">
              <svg className="h-8 w-8 text-indigo-500 sm:h-10 sm:w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
          </div>
          <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">No generated images yet</p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Start creating images to see them here</p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30">
            Start Creating
          </Link>
        </div>
      )}

      <div className="flex gap-3 sm:gap-4" style={{ alignItems: "flex-start" }}>
        {distributeIntoColumns(items, columnCount).map((column, colIndex) => (
          <div key={colIndex} className="flex flex-1 flex-col gap-3 sm:gap-4">
            {column.map((item) => {
              const imageSrc = item.imageUrl || `/api/history/${item.id}/image`;
              return (
                <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="relative overflow-hidden">
                    <Image
                      src={imageSrc}
                      alt={item.prompt}
                      width={item.width || 1024}
                      height={item.height || 1024}
                      unoptimized
                      className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />

                    <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <div className="flex justify-end p-2">
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="rounded-full bg-black/50 p-2 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
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

                      <div className="flex items-center justify-between gap-2 p-3">
                        <div className="flex gap-2">
                          <a
                            href={imageSrc}
                            download={`ai-image-${item.id}.png`}
                            className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-900 backdrop-blur-sm transition-colors hover:bg-white"
                            title="Download Image"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download
                          </a>

                          <button
                            onClick={() => copyImageUrl(item)}
                            className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-900 backdrop-blur-sm transition-colors hover:bg-white"
                            title="Copy Image URL"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Copy URL
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => regenerate(item)}
                            className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-900 backdrop-blur-sm transition-colors hover:bg-white"
                            title="Regenerate Image (same seed)"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="23 4 23 10 17 10" />
                              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                            Regenerate
                          </button>

                          <button
                            onClick={() => generateSimilar(item)}
                            className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-blue-700"
                            title="Generate Similar Image (new seed)"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                              <line x1="12" y1="8" x2="12" y2="16" />
                              <line x1="8" y1="12" x2="16" y2="12" />
                            </svg>
                            Similar
                          </button>

                          <button
                            onClick={() => createVariations(item)}
                            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30"
                            title="Create Variations"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 3v6" />
                              <path d="M8 7l4-4 4 4" />
                              <path d="M8 17l4 4 4-4" />
                              <path d="M12 21v-6" />
                            </svg>
                            Variations
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {item.prompt}
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-400">
                      {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {hasMore && !loading && !error && <div ref={sentinelRef} className="h-4" />}

      {loadingMore && (
        <div className="flex items-center justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
          <span className="ml-2 text-sm text-zinc-500">Loading more...</span>
        </div>
      )}

      {variationsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-zinc-800">
              <div>
                <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Image Variations</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Based on: {variationsModal.item.prompt.slice(0, 80)}...</p>
              </div>
              <button
                onClick={() => setVariationsModal(null)}
                className="rounded-full p-2 text-zinc-500 hover:bg-gray-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto p-6" style={{ maxHeight: "calc(90vh - 80px)" }}>
              {variationsModal.loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
                  <p className="mt-4 text-sm text-zinc-500">Generating variations...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {variationsModal.variations.map((variation, index) => (
                    <div key={variation.id} className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="relative aspect-square overflow-hidden">
                        <Image
                          src={variation.url}
                          alt={`Variation ${index + 1}`}
                          width={512}
                          height={512}
                          unoptimized
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <a
                            href={variation.url}
                            download={`variation-${index + 1}.png`}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-900 hover:bg-gray-100"
                            title="Download"
                          >
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </a>
                        </div>
                      </div>
                      <div className="border-t border-gray-200 p-2 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                        Variation {index + 1} · Seed: {variation.seed}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
