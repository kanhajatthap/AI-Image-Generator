"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion } from "motion/react";
import { ChatMessage, ChatMessageModel } from "./ChatMessage";
import { Sparkles, Camera, Mountain, Building2, ShoppingBag, Wand2 } from "lucide-react";

interface ChatWindowProps {
  messages: ChatMessageModel[];
  onSuggestion?: (prompt: string) => void;
  onRetry?: (prompt: string) => void;
}

const SUGGESTIONS = [
  {
    icon: Camera,
    title: "Portrait photography",
    subtitle: "Soft light, shallow depth of field",
    prompt:
      "Professional portrait photography, soft natural lighting, shallow depth of field, high quality, detailed facial features, artistic composition",
  },
  {
    icon: Mountain,
    title: "Fantasy landscape",
    subtitle: "Epic, magical, cinematic",
    prompt:
      "Epic fantasy landscape, magical atmosphere, dramatic sky, enchanted forest, mystical lighting, highly detailed, cinematic view",
  },
  {
    icon: Building2,
    title: "Cyberpunk city",
    subtitle: "Neon lights, high tech, dystopian",
    prompt:
      "cyberpunk style, neon lights, futuristic city, high tech, dystopian atmosphere, highly detailed",
  },
  {
    icon: ShoppingBag,
    title: "Product photography",
    subtitle: "Studio, commercial quality",
    prompt:
      "Professional product photography, clean studio background, soft box lighting, sharp focus, commercial quality, minimal shadows",
  },
];

export function ChatWindow({ messages, onSuggestion, onRetry }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const hasMessages = messages.length > 0;
  const sorted = useMemo(() => {
    return [...messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [sorted.length]);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950/50">
      {/* Aurora ambient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="aurora-blob aurora-blob-1 -left-32 -top-24 h-80 w-80 bg-indigo-400/30 dark:bg-indigo-600/20" />
        <div className="aurora-blob aurora-blob-2 -right-24 top-1/3 h-72 w-72 bg-fuchsia-400/25 dark:bg-fuchsia-600/20" />
        <div className="aurora-blob aurora-blob-3 bottom-0 left-1/3 h-64 w-64 bg-purple-400/20 dark:bg-purple-600/15" />
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          {!hasMessages && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mx-auto max-w-2xl pt-6 text-center sm:pt-10"
            >
              <div className="mb-6 flex justify-center">
                <div className="glow-border flex h-20 w-20 items-center justify-center rounded-3xl shadow-xl shadow-indigo-500/25">
                  <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500">
                    <Sparkles className="h-9 w-9 text-white" />
                  </div>
                </div>
              </div>

              <h2 className="font-heading text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
                Create something{" "}
                <span className="bg-gradient-to-r from-indigo-500 via-purple-600 to-fuchsia-500 bg-clip-text text-transparent">
                  beautiful
                </span>
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-zinc-500 dark:text-zinc-400 sm:text-base">
                Describe an idea to generate images, ask questions, or upload a photo to analyze. Try one of these:
              </p>

              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={s.title}
                    type="button"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.08 * i }}
                    onClick={() => onSuggestion?.(s.prompt)}
                    className="group flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white/70 p-4 text-left shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/15 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-indigo-600 dark:hover:shadow-indigo-500/10"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-indigo-600 transition-colors group-hover:from-indigo-500 group-hover:to-purple-600 group-hover:text-white dark:text-indigo-400">
                      <s.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{s.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{s.subtitle}</p>
                    </div>
                  </motion.button>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  onSuggestion?.(
                    "a dreamy sci-fi astronaut resting on the moon, cinematic lighting, ultra detailed, 8k, trending on artstation",
                  )
                }
                className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400"
              >
                <Wand2 className="h-4 w-4" />
                Or surprise me with something creative
              </button>

              <p className="mt-8 text-xs text-zinc-400 dark:text-zinc-600">
                Your generated images will be saved to history.
              </p>
            </motion.div>
          )}

          {sorted.map((m) => (
            <ChatMessage key={m.id} message={m} onRetry={onRetry} />
          ))}
        </div>
      </div>
    </div>
  );
}