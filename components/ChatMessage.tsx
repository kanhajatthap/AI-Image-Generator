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
  variations?: Variation[];
};

interface ChatMessageProps {
  message: ChatMessageModel;
}

type Variation = {
  id: string;
  url: string;
  seed: number;
  prompt: string;
};

export function ChatMessage({ message }: ChatMessageProps) {
  const [imageError, setImageError] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [variations, setVariations] = useState<Variation[]>(message.variations || []);
  const [variationsLoading, setVariationsLoading] = useState(false);

  const isUser = message.role === "user";
  const isVision = message.type === "vision";
  const isGeneratedImage = message.imageUrl && !isVision;
  const promptText = message.prompt || message.content;

  const generateSimilar = async () => {
    if (!message.imageUrl || !promptText) return;
    
    setVariationsLoading(true);
    try {
      const res = await fetch("/api/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalImageUrl: message.imageUrl,
          prompt: promptText,
          width: message.settings?.width || 1024,
          height: message.settings?.height || 1024,
          model: message.settings?.model || "flux",
          style: message.settings?.style,
          count: 4,
        }),
      });

      if (!res.ok) {
        alert("Failed to generate similar images.");
        setVariationsLoading(false);
        return;
      }

      const json = await res.json();
      setVariations(json.variations || []);
    } catch (error) {
      console.error("Similar images error:", error);
      alert("Failed to generate similar images.");
    } finally {
      setVariationsLoading(false);
    }
  };

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
            ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white"
            : "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100",
          isUser ? "" : "border border-gray-200 dark:border-zinc-800",
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
                  <button
                    onClick={generateSimilar}
                    disabled={variationsLoading}
                    className="rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50"
                  >
                    {variationsLoading ? "Generating..." : "Similar"}
                  </button>
                </div>

                {/* Variations Grid */}
                {variations.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {variations.map((variation, index) => (
                      <div key={variation.id} className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="relative aspect-square overflow-hidden">
                          <img
                            src={variation.url}
                            alt={`Variation ${index + 1}`}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                            <a
                              href={variation.url}
                              download={`variation-${index + 1}.png`}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-900 hover:bg-gray-100"
                              title="Download"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                            </a>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(variation.prompt);
                                alert("Prompt copied!");
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-900 hover:bg-gray-100"
                              title="Copy Prompt"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="border-t border-gray-200 p-2 text-center text-[10px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                          Variation {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Variations Loading */}
                {variationsLoading && (
                  <div className="mt-4 flex items-center justify-center gap-2 py-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
                    <span className="text-sm text-zinc-500">Generating similar images...</span>
                  </div>
                )}
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

