"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChatMessage, ChatMessageModel } from "./ChatMessage";

export function ChatWindow({
  messages,
  onDeleteHistory,
}: {
  messages: ChatMessageModel[];
  onDeleteHistory: (historyId: string) => Promise<void>;
}) {
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
    <div className="flex h-full flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {!hasMessages && (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              Start a new chat by typing a prompt below. Your generated images will be saved to history.
            </div>
          )}
          {sorted.map((m) => (
            <ChatMessage
              key={m.id}
              message={m}
              onDeleteHistory={
                m.historyId ? () => onDeleteHistory(m.historyId!) : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

