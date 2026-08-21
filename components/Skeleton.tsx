"use client";

export function ImageSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/5" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <ImageSkeleton className="aspect-square w-full" />
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mt-2 h-2 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

export function MasonrySkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex gap-4" style={{ alignItems: "flex-start" }}>
      {Array.from({ length: columns }).map((_, colIndex) => (
        <div key={colIndex} className="flex flex-1 flex-col gap-4">
          {Array.from({ length: colIndex === 0 ? 4 : 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function TextSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-4 w-4/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}
