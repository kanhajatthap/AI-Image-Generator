"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type Props = {
  prompt: string;
  imageUrl: string;
  onDelete?: () => Promise<void> | void;
};

export function ImageCard({ prompt, imageUrl, onDelete }: Props) {
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="p-3">
        <Image
          src={imageUrl}
          alt={prompt}
          width={1024}
          height={1024}
          unoptimized
          className="h-auto w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={imageUrl}
            download={filename}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Download
          </a>
          <button
            type="button"
            onClick={copyPrompt}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Copy prompt
          </button>
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

