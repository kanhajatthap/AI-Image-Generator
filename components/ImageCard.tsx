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
};

export function ImageCard({ prompt, imageUrl, settings, onDelete, onRegenerate, onGenerateSimilar }: Props) {
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

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="p-3">
        <Image
          src={imageUrl}
          alt={prompt}
          width={settings?.width || 1024}
          height={settings?.height || 1024}
          unoptimized
          className="h-auto w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Download */}
          <a
            href={imageUrl}
            download={filename}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Download
          </a>

          {/* Copy URL */}
          <button
            type="button"
            onClick={copyUrl}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {copiedUrl ? "Copied!" : "Copy URL"}
          </button>

          {/* Copy Prompt */}
          <button
            type="button"
            onClick={copyPrompt}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {copiedPrompt ? "Copied!" : "Copy Prompt"}
          </button>

          {/* Generate Similar */}
          {onGenerateSimilar && settings && (
            <button
              type="button"
              onClick={handleGenerateSimilar}
              disabled={busy}
              className="rounded-md border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/40"
            >
              {busy ? "Generating..." : "Generate Similar"}
            </button>
          )}

          {/* Regenerate */}
          {onRegenerate && settings && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={busy}
              className="rounded-md border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-60 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-950/40"
            >
              {busy ? "Regenerating..." : "Regenerate"}
            </button>
          )}

          {/* Delete */}
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              {busy ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

