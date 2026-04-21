"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChatMessage, ChatMessageModel } from "./ChatMessage";

interface ChatWindowProps {
  messages: ChatMessageModel[];
}

export function ChatWindow({ messages }: ChatWindowProps) {
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
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50/50 dark:bg-zinc-950/50">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          {!hasMessages && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 p-10 text-center shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 shadow-inner dark:from-indigo-950/30 dark:to-purple-950/30">
                  <svg className="h-8 w-8 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="7.5 4.21 12 6.81 16.5 4.21"/>
                    <polyline points="7.5 19.79 7.5 14.6 3 12"/>
                    <polyline points="21 12 16.5 14.6 16.5 19.79"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Start a new chat by typing a prompt below.</p>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Your generated images will be saved to history.</p>
            </div>
          )}
          {sorted.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

