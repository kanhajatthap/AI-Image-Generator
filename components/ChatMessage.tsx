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
  type?: "text" | "image" | "vision";
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
  const [copiedText, setCopiedText] = useState(false);

  const isUser = message.role === "user";
  const isVision = message.type === "vision";
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

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // ignore
    }
  };

  const downloadText = () => {
    const blob = new Blob([message.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "extracted-text.txt";
    link.click();
    URL.revokeObjectURL(url);
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
          "group relative max-w-[80%] rounded-2xl px-5 py-4 shadow-sm transition-all duration-200 hover:shadow-md",
          isUser
            ? "bg-gradient-to-br from-zinc-800 to-zinc-900 text-white dark:from-zinc-100 dark:to-zinc-200 dark:text-zinc-950"
            : "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100",
          isUser ? "" : "border border-gray-100 dark:border-zinc-800",
        ].join(" ")}
      >
        {/* Copy icon for text responses - top right */}
        {message.type === "text" && !message.typing && !isUser && (
          <button
            onClick={copyText}
            className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-gray-50 text-zinc-400 opacity-0 shadow-sm transition-all duration-200 hover:bg-white hover:text-zinc-700 hover:shadow-md group-hover:opacity-100 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
            title="Copy"
          >
            {copiedText ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
            )}
          </button>
        )}

        {/* Text content - shown for text and vision types, or when no image */}
        {(!message.imageUrl || message.type === "text" || isVision) && (
          <>
            <div className="text-sm whitespace-pre-wrap leading-6">
              {message.typing ? <Loader label="Generating..." /> : message.content}
            </div>

            {/* Vision action buttons */}
            {isVision && !message.typing && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={copyText}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  {copiedText ? "Copied!" : "Copy Text"}
                </button>
                <button
                  onClick={downloadText}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  Download Text
                </button>
              </div>
            )}
          </>
        )}

        {/* Image - shown for image generation only, not for vision */}
        {message.imageUrl && !isVision && !message.typing && (
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
                {/* Image action buttons */}
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

