"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";

const STAGES = [
  { label: "Analyzing your prompt", icon: "Sparkles" },
  { label: "Crafting the composition", icon: "LayoutGrid" },
  { label: "Rendering details", icon: "Wand2" },
  { label: "Applying final touches", icon: "Palette" },
];

const DURATION = 2400;

export function GenerationStages({ label }: { label?: string }) {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % STAGES.length);
    }, DURATION);
    return () => clearInterval(id);
  }, []);

  const stage = STAGES[stageIndex];

  return (
    <div className="w-full" aria-live="polite">
      <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
        {/* Shimmer canvas where the image will appear */}
        <div className="relative aspect-square w-full max-w-md bg-gradient-to-br from-zinc-100 via-zinc-200 to-zinc-300 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="h-10 w-10 text-zinc-400 dark:text-zinc-600" />
          </div>
        </div>

        {/* Stage indicator */}
        <div className="flex min-h-[52px] items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-indigo-500"
                  style={{
                    animation: "stage-pulse 1.2s ease-in-out infinite",
                    animationDelay: `${i * 0.18}s`,
                  }}
                />
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.span
                key={stageIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="text-sm font-medium text-zinc-600 dark:text-zinc-300"
              >
                {label || stage.label}
              </motion.span>
            </AnimatePresence>
          </div>
          <span className="shrink-0 rounded-full bg-indigo-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Generating
          </span>
        </div>
      </div>
    </div>
  );
}