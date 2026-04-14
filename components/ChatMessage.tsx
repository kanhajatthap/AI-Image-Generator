"use client";

import { useState, useEffect } from "react";
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
  type?: "text" | "image";
  imageUrl?: string;
  createdAt: string;
  typing?: boolean;
  historyId?: string;
  settings?: ImageSettings;
  prompt?: string;
};

interface ChatMessageProps {
  message: ChatMessageModel;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [imageError, setImageError] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const isUser = message.role === "user";
  const promptText = message.prompt || message.content;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      // ignore
    }
  };

  const downloadImage = () => {
    if (!message.imageUrl) return;
    const link = document.createElement("a");
    link.href = message.imageUrl;
    link.download = `generated-${message.id}.png`;
    link.click();
  };

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
        {/* Text content - shown only when there's no image */}
        {(!message.imageUrl || message.type === "text") && (
          <div className="text-sm whitespace-pre-wrap leading-6">
            {message.typing ? <Loader label="Generating..." /> : message.content}
          </div>
        )}

        {/* Image - shown whenever imageUrl exists */}
        {message.imageUrl && !message.typing && (
          <div className="mt-2" key={message.imageUrl}>
            {imageError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                Failed to load image.
              </div>
            )}
            {!imageError && (
              <>
                <img
                  src={message.imageUrl}
                  alt="Generated image"
                  className="max-w-full rounded-lg"
                  onError={(e) => {
                    console.error("Image failed to load:", e);
                    setImageError(true);
                  }}
                />
                {/* Action Buttons */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={copyPrompt}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    {copiedPrompt ? "Copied!" : "Copy Prompt"}
                  </button>
                  <button
                    onClick={downloadImage}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    Download
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          {new Date(message.createdAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

