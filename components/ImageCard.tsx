"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { ImageSettings } from "./ChatMessage";

type Props = {
  prompt: string;
  imageUrl: string;
  settings?: ImageSettings;
  onDelete?: () => Promise<void> | void;
  onRegenerate?: (prompt: string, settings: ImageSettings) => Promise<void> | void;
  onGenerateSimilar?: (prompt: string, settings: ImageSettings) => Promise<void> | void;
  onCreateVariation?: (prompt: string, settings: ImageSettings) => Promise<void> | void;
};

export function ImageCard({ prompt, imageUrl, settings, onDelete, onRegenerate, onGenerateSimilar, onCreateVariation }: Props) {
  const [busy, setBusy] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const filename = useMemo(() => {
    const safe = prompt
      .trim()
      .slice(0, 40)
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase();
    return `ai-image-${safe || "generated"}.png`;
  }, [prompt]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      // ignore
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const ok = window.confirm("Delete this image from history?");
    if (!ok) return;
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async () => {
    if (!onRegenerate || !settings) return;
    setBusy(true);
    try {
      // Regenerate with same settings (same seed for identical image)
      await onRegenerate(prompt, settings);
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateSimilar = async () => {
    if (!onGenerateSimilar || !settings) return;
    setBusy(true);
    try {
      // Generate similar with different seed
      const newSettings = { ...settings, seed: Math.floor(Math.random() * 1000000) };
      await onGenerateSimilar(prompt, newSettings);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateVariation = async () => {
    if (!onCreateVariation || !settings) return;
    setBusy(true);
    try {
      // Create variation with modified seed (add random offset to original)
      const originalSeed = settings.seed || 0;
      const variationSeed = originalSeed + Math.floor(Math.random() * 1000) + 1;
      const newSettings = { ...settings, seed: variationSeed };
      await onCreateVariation(prompt, newSettings);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="p-3">
        {/* Image Container with Hover Overlay */}
        <div className="group relative overflow-hidden rounded-lg">
          <Image
            src={imageUrl}
            alt={prompt}
            width={settings?.width || 1024}
            height={settings?.height || 1024}
            unoptimized
            className="h-auto w-full border border-zinc-200 transition-transform duration-300 group-hover:scale-105 dark:border-zinc-800"
          />

          {/* Hover Overlay - ChatGPT Style */}
          <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {/* Top Actions */}
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy || !onDelete}
                className="rounded-full bg-black/50 p-2 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white disabled:opacity-40"
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

            {/* Bottom Actions */}
            <div className="flex items-center justify-between gap-2 p-3">
              {/* Left: Download & Copy URL */}
              <div className="flex gap-2">
                <a
                  href={imageUrl}
                  download={filename}
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
                  type="button"
                  onClick={copyUrl}
                  className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-900 backdrop-blur-sm transition-colors hover:bg-white"
                  title="Copy Image URL"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  {copiedUrl ? "Copied!" : "Copy URL"}
                </button>
              </div>

              {/* Right: Regenerate */}
              {onRegenerate && settings && (
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-900 backdrop-blur-sm transition-colors hover:bg-white disabled:opacity-60"
                  title="Regenerate Image"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  {busy ? "..." : "Regenerate"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Prompt & Actions Below */}
        <div className="mt-3 space-y-2">
          {/* Seed Display */}
          {settings?.seed !== undefined && (
            <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-500">
              Seed: {settings.seed}
            </p>
          )}

          {/* Prompt Text */}
          <p className="text-xs text-zinc-600 line-clamp-2 dark:text-zinc-400">
            {prompt}
          </p>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Copy Prompt */}
            <button
              type="button"
              onClick={copyPrompt}
              className="flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
              {copiedPrompt ? "Copied!" : "Copy Prompt"}
            </button>

            {/* Create Variation */}
            {onCreateVariation && settings && (
              <button
                type="button"
                onClick={handleCreateVariation}
                disabled={busy}
                className="flex items-center gap-1 rounded-md bg-purple-600 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-60 dark:bg-purple-600 dark:hover:bg-purple-500"
                title="Create variation with modified seed"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                {busy ? "Creating..." : "Create Variation"}
              </button>
            )}

            {/* Generate Similar - Highlighted */}
            {onGenerateSimilar && settings && (
              <button
                type="button"
                onClick={handleGenerateSimilar}
                disabled={busy}
                className="flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                {busy ? "Generating..." : "Generate Similar"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

