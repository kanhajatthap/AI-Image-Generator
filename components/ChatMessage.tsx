"use client";

import { ImageCard } from "./ImageCard";
import { Loader } from "./Loader";

export type ChatMessageModel = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  createdAt: string;
  typing?: boolean;
  historyId?: string;
};

export function ChatMessage({
  message,
  onDeleteHistory,
}: {
  message: ChatMessageModel;
  onDeleteHistory?: (historyId: string) => Promise<void>;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
          isUser
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
            : "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100",
          "border border-zinc-200 dark:border-zinc-800",
        ].join(" ")}
      >
        <div className="text-sm whitespace-pre-wrap leading-6">
          {message.typing ? <Loader label="Generating..." /> : message.content}
        </div>

        {message.imageUrl && !message.typing && (
          <ImageCard
            prompt={message.content}
            imageUrl={message.imageUrl}
            onDelete={
              message.historyId && onDeleteHistory
                ? () => onDeleteHistory(message.historyId!)
                : undefined
            }
          />
        )}

        <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          {new Date(message.createdAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

