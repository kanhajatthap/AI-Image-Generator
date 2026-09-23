 "use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar, type HistoryListItem } from "../components/Sidebar";
import { ChatWindow } from "../components/ChatWindow";
import type { ChatMessageModel, Variation } from "../components/ChatMessage";
import { PromptInput, type PromptInputHandle, PromptInputOptions } from "../components/PromptInput";
import { useTheme } from "../components/ThemeProvider";
import { toast } from "sonner";
import { Menu, X, Moon, Sun, BrainCircuit, LogIn, UserPlus, Search } from "lucide-react";

const DEFAULT_MODEL = "black-forest-labs/FLUX.1-schnell";

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function getErrorMessage(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  const msg = (json && typeof json.error === "string" && json.error) || fallback;
  const details = (json && typeof json.details === "string" && json.details) || "";
  const base = res.status >= 500 ? `${msg} (HTTP ${res.status})` : msg;
  return details ? `${base} — ${details}` : base;
}

export default function Home() {
  const { theme, toggle } = useTheme();
  const [history, setHistory] = useState<HistoryListItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageModel[]>([]);
  const [busy, setBusy] = useState(false);
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(null);
  const [authUser, setAuthUser] = useState<{ name: string; email: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const promptInputRef = useRef<PromptInputHandle>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const isLoggedIn = !!authUser;

  const loadUser = async () => {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) {
      setAuthUser(null);
      return;
    }
    const json = await res.json();
    setAuthUser(json?.user || null);
  };

  const loadHistoryList = async () => {
    const res = await fetch("/api/history", { cache: "no-store" });
    if (!res.ok) {
      setHistory([]);
      return;
    }
    const json = await res.json();
    const items: Array<{ id: string; prompt: string; title?: string; pinned?: boolean; createdAt: string }> =
      Array.isArray(json?.items)
      ? json.items
      : [];
    setHistory(
      items.map((x) => ({
        id: x.id,
        prompt: x.prompt,
        title: x.title,
        pinned: x.pinned,
        createdAt: x.createdAt,
      })),
    );
  };

  useEffect(() => {
    loadUser();
    loadHistoryList();
  }, []);

  // Close mobile drawer on outside click + lock body scroll
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    const onNewChat = () => newChat();
    const onOpenHistory = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id) openHistory(detail.id);
    };
    const onRename = () => {
      if (!activeHistoryId) return;
      const t = prompt("Enter a title for this conversation:");
      if (t?.trim()) renameHistory(activeHistoryId, t.trim());
    };
    const onDelete = () => {
      if (!activeHistoryId) return;
      if (confirm("Delete this conversation?")) deleteHistory(activeHistoryId);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("palette:new-chat", onNewChat);
    window.addEventListener("palette:open-history", onOpenHistory);
    window.addEventListener("palette:rename", onRename);
    window.addEventListener("palette:delete", onDelete);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("palette:new-chat", onNewChat);
      window.removeEventListener("palette:open-history", onOpenHistory);
      window.removeEventListener("palette:rename", onRename);
      window.removeEventListener("palette:delete", onDelete);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHistoryId]);

  const newChat = () => {
    setActiveHistoryId(null);
    setMessages([]);
    setMobileMenuOpen(false);
  };

  const openHistory = async (id: string) => {
    setActiveHistoryId(id);
    setMobileMenuOpen(false);
    const res = await fetch(`/api/history/${id}`, { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    const item = json?.item;
    if (!item) return;
    const createdAt = new Date(item.createdAt).toISOString();
    const imgUrl = `/api/history/${id}/image`;
    setMessages([
      { id: uid(), role: "user", content: item.prompt, createdAt },
      {
        id: uid(),
        role: "assistant",
        content: item.mimeType === "text/plain" ? item.generatedText : item.prompt,
        ...(item.mimeType !== "text/plain" && { imageUrl: imgUrl }),
        createdAt,
        historyId: id,
      },
    ]);
  };

  const deleteHistory = async (id: string) => {
    const res = await fetch("/api/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) return;
    setHistory((prev) => prev.filter((x) => x.id !== id));
    if (activeHistoryId === id) newChat();
  };

  const renameHistory = async (id: string, title: string) => {
    const res = await fetch("/api/history", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title }),
    });
    if (!res.ok) return;
    setHistory((prev) => prev.map((x) => (x.id === id ? { ...x, title } : x)));
  };

  const togglePinHistory = async (id: string) => {
    const current = history.find((x) => x.id === id);
    const pinned = !current?.pinned;
    const res = await fetch("/api/history", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pinned }),
    });
    if (!res.ok) return;
    await loadHistoryList();
  };

  const canSend = useMemo(() => {
    const now = Date.now();
    const isRateLimited = rateLimitUntil !== null && now < rateLimitUntil;
    return isLoggedIn && !busy && !isRateLimited;
  }, [isLoggedIn, busy, rateLimitUntil]);

  const markError = (content: string, retryPrompt?: string) => ({
    typing: false,
    content,
    isError: true,
    ...(retryPrompt ? { retryPrompt } : {}),
  });

  const handleRetry = (prompt: string) => {
    sendPrompt({
      prompt,
      width: 1024,
      height: 1024,
      model: "flux",
    });
  };

  const enhancePrompt = async (prompt: string): Promise<string> => {
    const res = await fetch(`/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `Enhance this image generation prompt to be more detailed and descriptive, add artistic details and lighting information. Original prompt: "${prompt}". Return only the enhanced prompt text without any explanations.`,
        model: DEFAULT_MODEL,
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to enhance prompt");
    }

    const json = await res.json();
    return json.text || prompt;
  };

  const sendPrompt = async (options: PromptInputOptions) => {
    if (busy) {
      return;
    }

    // Check rate limit cooldown
    if (rateLimitUntil !== null && Date.now() < rateLimitUntil) {
      return;
    }

    if (!isLoggedIn) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: "Please login first to generate and save your history.",
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }

    const { prompt, image, batchCount } = options;
    if (image) {
      console.log("[PAGE] Image details:", image.name, image.size, image.type);
    }

    if (batchCount && batchCount > 1) {
      const now = new Date().toISOString();
      const userMsg: ChatMessageModel = {
        id: uid(),
        role: "user",
        content: prompt,
        createdAt: now,
      };
      const typingMsg: ChatMessageModel = {
        id: uid(),
        role: "assistant",
        content: `Generating ${batchCount} images...`,
        createdAt: now,
        typing: true,
      };
      setMessages((prev) => [...prev, userMsg, typingMsg]);
      setBusy(true);

      try {
        let res: Response;
        try {
          res = await fetch("/api/batch-generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt,
              count: batchCount,
              width: options.width,
              height: options.height,
              model: options.model,
            }),
          });
        } catch {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === typingMsg.id
                ? { ...m, ...markError("Could not reach the server. Check your internet connection and try again.", prompt) }
                : m,
            ),
          );
          return;
        }

        if (!res.ok) {
          const errText = await getErrorMessage(res, "Failed to generate batch. Please try again.");
          setMessages((prev) =>
            prev.map((m) => (m.id === typingMsg.id ? { ...m, ...markError(errText, prompt) } : m)),
          );
          return;
        }

        const json = await res.json();
        const batchImages: Variation[] =
          (json.images as Array<{ id?: string; url?: string; seed?: number }> | undefined)
            ?.filter((img): img is { id: string; url: string; seed?: number } => Boolean(img.id && img.url))
            .map((img) => ({ id: img.id, url: img.url, seed: img.seed ?? 0, prompt })) || [];
        setMessages((prev) =>
          prev.map((m) =>
            m.id === typingMsg.id ? {
              ...m,
              typing: false,
              type: "text",
              content: `Generated ${batchCount} images:`,
              prompt: prompt,
              variations: batchImages,
              historyId: json.historyId,
            } : m,
          ),
        );
        await loadHistoryList();
      } finally {
        setBusy(false);
      }
      return;
    }

    const now = new Date().toISOString();
    const userMsg: ChatMessageModel = {
      id: uid(),
      role: "user",
      content: prompt,
      createdAt: now,
      imageUrl: image ? URL.createObjectURL(image) : undefined,
    };
    const typingMsg: ChatMessageModel = {
      id: uid(),
      role: "assistant",
      content: prompt,
      createdAt: now,
      typing: true,
    };
    setMessages((prev) => [...prev, userMsg, typingMsg]);
    setBusy(true);

try {
        let res: Response;
        try {
          if (image) {
            const formData = new FormData();
            formData.append("prompt", prompt);
            formData.append("image", image);
            res = await fetch("/api/chat", {
              method: "POST",
              body: formData,
            });
          } else {
            res = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt }),
            });
          }
        } catch {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === typingMsg.id
                ? { ...m, ...markError("Could not reach the server. Check your internet connection and try again.", prompt) }
                : m,
            ),
          );
          return;
        }

        if (!res.ok) {
          if (res.status === 429) {
            const cooldownMs = 15000; // 15 seconds
            setRateLimitUntil(Date.now() + cooldownMs);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === typingMsg.id
                  ? { ...m, typing: false, content: "Rate limit reached. Please wait 15 seconds before trying again." }
                  : m,
              ),
            );
            // Clear cooldown after 15 seconds
            setTimeout(() => setRateLimitUntil(null), cooldownMs);
            return;
          }

          const errText = await getErrorMessage(res, "Failed to generate. Please try again.");
          setMessages((prev) =>
            prev.map((m) => (m.id === typingMsg.id ? { ...m, ...markError(errText, prompt) } : m)),
          );
          return;
        }

      // Parse JSON response from API
      const json = await res.json();

      if (json.type === "image") {
        // Display generated image from URL
        setMessages((prev) =>
          prev.map((m) =>
            m.id === typingMsg.id ? {
              ...m,
              typing: false,
              type: "image",
              imageUrl: json.url,
              prompt: prompt,
            } : m,
          ),
        );
      } else if (json.type === "vision") {
        // Display OCR text only (no image)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === typingMsg.id ? {
              ...m,
              typing: false,
              type: "vision",
              content: json.text,
              prompt: prompt,
            } : m,
          ),
        );
      } else if (json.type === "text") {
        // Display text response
        setMessages((prev) =>
          prev.map((m) =>
            m.id === typingMsg.id ? { ...m, typing: false, type: "text", content: json.text } : m,
          ),
        );
      } else if (json.type === "variations") {
        // Display variations grid - don't set imageUrl to avoid loading issues
        setMessages((prev) =>
          prev.map((m) =>
            m.id === typingMsg.id ? {
              ...m,
              typing: false,
              type: "text",
              content: "Generated similar images:",
              prompt: json.prompt,
              variations: json.variations,
              historyId: json.historyId,
            } : m,
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthUser(null);
    newChat();
    toast.success("Logged out");
  };

const useSuggestion = (prompt: string) => {
    promptInputRef.current?.setValue(prompt);
  };

  return (
    <div className="h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex h-full">
        <Sidebar
          items={history}
          activeId={activeHistoryId}
          onNewChat={newChat}
          onSelect={openHistory}
          onDelete={deleteHistory}
          onRename={renameHistory}
          onTogglePin={togglePinHistory}
          authUser={authUser}
          onLogout={logout}
        />

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-zoom-fade"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div
              ref={mobileMenuRef}
              className="absolute left-0 top-0 bottom-0 h-full shadow-2xl animate-reveal-up"
            >
              <Sidebar
                items={history}
                activeId={activeHistoryId}
                onNewChat={newChat}
                onSelect={openHistory}
                onDelete={deleteHistory}
                onRename={renameHistory}
                onTogglePin={togglePinHistory}
                authUser={authUser}
                onLogout={logout}
                className="flex h-full w-[280px] flex-col"
              />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="absolute -right-12 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-600 shadow-lg dark:bg-zinc-800 dark:text-zinc-200"
                title="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex h-full flex-1 flex-col overflow-hidden">
          <header className="flex items-center justify-between border-b border-gray-200/80 bg-white/80 px-4 py-4 backdrop-blur-md transition-all duration-300 sm:px-6 dark:border-zinc-800/80 dark:bg-zinc-950/80">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 md:hidden"
                title="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20">
                <BrainCircuit className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-heading text-base font-semibold text-zinc-800 dark:text-zinc-100">
                  AI Image Generator
                </span>
                <span className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:block">
                  Create stunning images with AI
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("palette:open"))}
                className="group flex h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-zinc-500 transition-all duration-200 hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-indigo-600 dark:hover:text-indigo-300"
                title="Search (Ctrl+K)"
              >
                <Search className="h-4 w-4" />
                <span className="hidden text-xs lg:inline">Search</span>
                <kbd className="hidden rounded border border-zinc-200 px-1 text-[10px] font-medium text-zinc-400 group-hover:border-indigo-200 dark:border-zinc-700 sm:inline dark:group-hover:border-indigo-700">
                  Ctrl K
                </kbd>
              </button>

              <button
                type="button"
                onClick={toggle}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 transition-all duration-200 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {!authUser && (
                <div className="ml-2 hidden items-center gap-2 sm:flex">
                  <Link
                    href="/login"
                    className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
                  >
                    <LogIn className="h-4 w-4" />
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30"
                  >
                    <UserPlus className="h-4 w-4" />
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </header>

          <ChatWindow messages={messages} onSuggestion={useSuggestion} onRetry={handleRetry} />

          <PromptInput
            ref={promptInputRef}
            onSend={sendPrompt}
            onEnhance={enhancePrompt}
            onOCRResult={(text) => {
              const ocrMsg: ChatMessageModel = {
                id: uid(),
                role: "assistant",
                content: text,
                type: "text",
                createdAt: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, ocrMsg]);
            }}
            disabled={!canSend}
          />

          {!isLoggedIn && (
            <div className="border-t border-gray-200/80 bg-white/60 px-6 py-3 text-center text-xs text-zinc-500 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/60 dark:text-zinc-400">
              Login required to generate images (so your history can be saved).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
