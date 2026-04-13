"use client";

import { ImageCard } from "./ImageCard";
import { Loader } from "./Loader";

export interface ImageSettings {
  width?: number;
  height?: number;
  seed?: number;
  model?: string;
  style?: string;
}

export type ChatMessageModel = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  createdAt: string;
  typing?: boolean;
  historyId?: string;
  settings?: ImageSettings;
  prompt?: string;
};

interface ChatMessageProps {
  message: ChatMessageModel;
  onDeleteHistory?: (historyId: string) => Promise<void>;
  onRegenerate?: (prompt: string, settings: ImageSettings) => Promise<void>;
  onGenerateSimilar?: (prompt: string, settings: ImageSettings) => Promise<void>;
}

export function ChatMessage({
  message,
  onDeleteHistory,
  onRegenerate,
  onGenerateSimilar,
}: ChatMessageProps) {
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
            prompt={message.prompt || message.content}
            imageUrl={message.imageUrl}
            settings={message.settings}
            onDelete={
              message.historyId && onDeleteHistory
                ? () => onDeleteHistory(message.historyId!)
                : undefined
            }
            onRegenerate={onRegenerate}
            onGenerateSimilar={onGenerateSimilar}
          />
        )}

        <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          {new Date(message.createdAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

