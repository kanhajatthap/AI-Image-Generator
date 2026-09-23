"use client";

import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { GenerationStages } from "./GenerationStages";
import { Lightbox, type LightboxItem } from "./Lightbox";
import {
  Copy,
  Check,
  Download,
  Wand2,
  FileDown,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCcw,
} from "lucide-react";

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
  isError?: boolean;
  retryPrompt?: string;
};

interface ChatMessageProps {
  message: ChatMessageModel;
  onRetry?: (prompt: string) => void;
}

export type Variation = {
  id: string;
  url: string;
  seed: number;
  prompt: string;
};

export function ChatMessage({ message, onRetry }: ChatMessageProps) {
  const [imageError, setImageError] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showVariations, setshowVariations] = useState(true);
  const [variations, setVariations] = useState<Variation[]>(message.variations || []);
  const [variationsLoading, setVariationsLoading] = useState(false);

  const isUser = message.role === "user";
  const isVision = message.type === "vision";
  const promptText = message.prompt || message.content;

  // Mirrors the server's isImageGenerationRequest() in app/api/chat/route.ts
  // so the pending indicator matches what the API will actually return.
  const isImagePrompt = useMemo(() => {
    const imageKeywords = [
      "image", "photo", "picture", "generate image", "create image",
      "draw", "paint", "sketch", "illustration", "logo", "design",
      "poster", "vector", "icon", "art", "artwork", "render", "3d",
    ];
    const lower = promptText.toLowerCase();
    return imageKeywords.some((word) => lower.includes(word));
  }, [promptText]);

  const lightboxItems = useMemo<LightboxItem[]>(() => {
    const items: LightboxItem[] = [];
    if (message.imageUrl && !isVision) {
      items.push({
        url: message.imageUrl,
        prompt: promptText,
        seed: message.settings?.seed,
      });
    }
    for (const v of variations) {
      items.push({ url: v.url, prompt: v.prompt, seed: v.seed });
    }
    return items;
  }, [message.imageUrl, isVision, promptText, variations, message.settings?.seed]);

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
        toast.error("Failed to generate similar images.");
        setVariationsLoading(false);
        return;
      }

      const json = await res.json();
      setVariations(json.variations || []);
      toast.success(`${(json.variations || []).length} similar images generated`);
    } catch (error) {
      console.error("Similar images error:", error);
      toast.error("Failed to generate similar images.");
    } finally {
      setVariationsLoading(false);
    }
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      toast.success("Prompt copied");
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      toast.error("Could not copy prompt");
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedText(true);
      toast.success("Text copied");
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      toast.error("Could not copy text");
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
    toast.success("Text downloaded");
  };

  const downloadImage = () => {
    if (!message.imageUrl) return;
    const link = document.createElement("a");
    link.href = message.imageUrl;
    link.download = `generated-${message.id}.png`;
    link.click();
    toast.success("Image downloaded");
  };

  const renderTyping = () => (
    <div className="w-full">
      {isImagePrompt ? (
        <GenerationStages label="Generating your image..." />
      ) : (
        <div className="flex items-center gap-2.5 py-1.5">
          <span className="flex items-center gap-1">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
          <span className="text-sm text-zinc-400 dark:text-zinc-500">Thinking...</span>
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div
        className={[
          "group relative max-w-[85%] rounded-2xl px-5 py-4 shadow-sm transition-all duration-200 hover:shadow-md",
          isUser
            ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-indigo-600/20"
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
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {/* Typing / staged generation */}
        {message.typing ? (
          renderTyping()
        ) : (
          <>
            {/* Text content - shown for text and vision types, or when no image */}
            {(!message.imageUrl || message.type === "text" || isVision) && (
              <>
                {message.isError ? (
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="text-sm whitespace-pre-wrap leading-6">{message.content}</div>
                      {message.retryPrompt && onRetry && (
                        <button
                          type="button"
                          onClick={() => onRetry(message.retryPrompt!)}
                          className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60"
                        >
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap leading-6">{message.content}</div>
                )}

                {isVision && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={copyText}
                      className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      {copiedText ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedText ? "Copied!" : "Copy Text"}
                    </button>
                    <button
                      onClick={downloadText}
                      className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      Download Text
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Image - shown for image generation only, not for vision */}
            {message.imageUrl && !isVision && (
              <div className="mt-2">
                {imageError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                    Failed to load image.
                  </div>
                ) : (
                  <>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.35 }}
                      className="relative overflow-hidden rounded-lg"
                    >
                      <img
                        src={message.imageUrl}
                        alt="Generated image"
                        className="max-h-[560px] w-auto max-w-full cursor-zoom-in rounded-lg"
                        loading="lazy"
                        onClick={() => setLightboxIndex(0)}
                        onError={(e) => {
                          console.error("Image failed to load:", e);
                          setImageError(true);
                        }}
                      />
                      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <div className="absolute inset-0 rounded-lg bg-black/0" />
                      </div>
                    </motion.div>

                    {/* Image action buttons */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={copyPrompt}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        {copiedPrompt ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedPrompt ? "Copied!" : "Copy Prompt"}
                      </button>
                      <button
                        onClick={downloadImage}
                        className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </button>
                      <button
                        onClick={generateSimilar}
                        disabled={variationsLoading}
                        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        {variationsLoading ? "Generating..." : "Similar"}
                      </button>
                    </div>

                    {/* Variations Grid */}
                    {variations.length > 0 && (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => setshowVariations((v) => !v)}
                          className="flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          {variations.length} variations
                          {showVariations ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                        {showVariations && (
                          <div className="grid grid-cols-2 gap-3 pt-3 md:grid-cols-4">
                            {variations.map((variation, index) => (
                              <div
                                key={variation.id}
                                className="group relative cursor-zoom-in overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-950"
                              >
                                <div className="relative aspect-square overflow-hidden">
                                  <img
                                    src={variation.url}
                                    alt={`Variation ${index + 1}`}
                                    loading="lazy"
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                                    onClick={() => setLightboxIndex(index + 1)}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                    <a
                                      href={variation.url}
                                      download={`variation-${index + 1}.png`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-900 hover:bg-gray-100"
                                      title="Download"
                                    >
                                      <Download className="h-4 w-4" />
                                    </a>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(variation.prompt);
                                        toast.success("Prompt copied");
                                      }}
                                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-900 hover:bg-gray-100"
                                      title="Copy Prompt"
                                    >
                                      <Copy className="h-4 w-4" />
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
                      </div>
                    )}

                    {/* Variations Loading */}
                    {variationsLoading && (
                      <div className="mt-4 flex items-center justify-center gap-2 py-4">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                        <span className="text-sm text-zinc-500">Generating similar images...</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {!message.typing && (
          <div className="mt-2 text-[11px] text-zinc-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-zinc-500">
            {new Date(message.createdAt).toLocaleString()}
          </div>
        )}
      </div>

      <Lightbox
        items={lightboxItems}
        index={lightboxItems.length > 0 ? lightboxIndex : null}
        onClose={() => setLightboxIndex(null)}
      />
    </motion.div>
  );
}