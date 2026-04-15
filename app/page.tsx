 "use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sidebar, type HistoryListItem } from "../components/Sidebar";
import { ChatWindow } from "../components/ChatWindow";
import type { ChatMessageModel, ImageSettings } from "../components/ChatMessage";
import { PromptInput, PromptInputOptions } from "../components/PromptInput";

const DEFAULT_MODEL = "black-forest-labs/FLUX.1-schnell";

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Home() {
  const [history, setHistory] = useState<HistoryListItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageModel[]>([]);
  const [busy, setBusy] = useState(false);
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(null);
  const [authUser, setAuthUser] = useState<{ name: string; email: string } | null>(null);

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

  const newChat = () => {
    setActiveHistoryId(null);
    setMessages([]);
  };

  const openHistory = async (id: string) => {
    setActiveHistoryId(id);
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
    // Prevent multiple concurrent requests
    if (busy) {
      console.log("Request already in progress, ignoring duplicate.");
      return;
    }

    // Check rate limit cooldown
    if (rateLimitUntil !== null && Date.now() < rateLimitUntil) {
      const secondsLeft = Math.ceil((rateLimitUntil - Date.now()) / 1000);
      console.log(`Rate limit cooldown active. Please wait ${secondsLeft} seconds.`);
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

    const { prompt, image } = options;
    console.log("[PAGE] sendPrompt called with:", { prompt, hasImage: !!image });
    if (image) {
      console.log("[PAGE] Image details:", image.name, image.size, image.type);
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

      if (image) {
        console.log("[PAGE] Sending FormData request to /api/chat");
        const formData = new FormData();
        formData.append("prompt", prompt);
        formData.append("image", image);
        console.log("[PAGE] FormData prepared");
        res = await fetch("/api/chat", {
          method: "POST",
          body: formData,
        });
      } else {
        console.log("[PAGE] Sending JSON request to /api/chat");
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
      }

      console.log("[PAGE] Response status:", res.status, res.statusText);

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json?.error || "Failed to generate.";
        const details = json?.details || "";
        console.error("API Error:", { status: res.status, error: msg, details, fullResponse: json });

        // Handle 429 rate limit with user-friendly message and 15-second cooldown
        if (res.status === 429) {
          const cooldownMs = 15000; // 15 seconds
          setRateLimitUntil(Date.now() + cooldownMs);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === typingMsg.id
                ? { ...m, typing: false, content: "Rate limit reached. Please wait 15 seconds before trying again." }
                : m
            ),
          );
          // Clear cooldown after 15 seconds
          setTimeout(() => setRateLimitUntil(null), cooldownMs);
          return;
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === typingMsg.id ? { ...m, typing: false, content: `${msg}${details ? ` (${details})` : ""}` } : m)),
        );
        return;
      }

      // Parse JSON response from Pollinations API
      const json = await res.json();
      console.log("[PAGE] API response:", json);

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
      } else {
        // Fallback for unexpected response format
        setMessages((prev) =>
          prev.map((m) =>
            m.id === typingMsg.id ? { ...m, typing: false, content: "Unexpected response format." } : m,
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
  };

  // Regenerate image with same settings
  const handleRegenerate = async (prompt: string, settings: ImageSettings) => {
    if (busy) return;

    const now = new Date().toISOString();
    const userMsg: ChatMessageModel = { id: uid(), role: "user", content: prompt, createdAt: now };
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
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: DEFAULT_MODEL,
          historyId: activeHistoryId,
          width: settings.width,
          height: settings.height,
          seed: settings.seed,
          model_type: settings.model,
          style: settings.style,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json?.error || "Failed to regenerate.";
        setMessages((prev) =>
          prev.map((m) => (m.id === typingMsg.id ? { ...m, typing: false, content: msg } : m)),
        );
        return;
      }

      const json = await res.json();
      const newHistoryId = json.historyId || null;

      if (json.type === "image") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === typingMsg.id ? {
              ...m,
              typing: false,
              type: "image",
              imageUrl: json.url,
              settings: json.settings,
              prompt: prompt,
            } : m,
          ),
        );
      }

      if (newHistoryId && !activeHistoryId) {
        setActiveHistoryId(newHistoryId);
      }
      await loadHistoryList();
    } finally {
      setBusy(false);
    }
  };

  // Generate similar image with new seed
  const handleGenerateSimilar = async (prompt: string, settings: ImageSettings) => {
    if (busy) return;

    const now = new Date().toISOString();
    const userMsg: ChatMessageModel = { id: uid(), role: "user", content: prompt, createdAt: now };
    const typingMsg: ChatMessageModel = {
      id: uid(),
      role: "assistant",
      content: `${prompt} (similar)`,
      createdAt: now,
      typing: true,
    };
    setMessages((prev) => [...prev, userMsg, typingMsg]);
    setBusy(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: DEFAULT_MODEL,
          historyId: activeHistoryId,
          width: settings.width,
          height: settings.height,
          seed: settings.seed,
          model_type: settings.model,
          style: settings.style,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json?.error || "Failed to generate similar image.";
        setMessages((prev) =>
          prev.map((m) => (m.id === typingMsg.id ? { ...m, typing: false, content: msg } : m)),
        );
        return;
      }

      const json = await res.json();
      const newHistoryId = json.historyId || null;

      if (json.type === "image") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === typingMsg.id ? {
              ...m,
              typing: false,
              type: "image",
              imageUrl: json.url,
              settings: json.settings,
              prompt: prompt,
            } : m,
          ),
        );
      }

      if (newHistoryId && !activeHistoryId) {
        setActiveHistoryId(newHistoryId);
      }
      await loadHistoryList();
    } finally {
      setBusy(false);
    }
  };

  // Create variation with modified seed
  const handleCreateVariation = async (prompt: string, settings: ImageSettings) => {
    if (busy) return;

    const now = new Date().toISOString();
    const userMsg: ChatMessageModel = { id: uid(), role: "user", content: prompt, createdAt: now };
    const typingMsg: ChatMessageModel = {
      id: uid(),
      role: "assistant",
      content: `${prompt} (variation)`,
      createdAt: now,
      typing: true,
    };
    setMessages((prev) => [...prev, userMsg, typingMsg]);
    setBusy(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: DEFAULT_MODEL,
          historyId: activeHistoryId,
          width: settings.width,
          height: settings.height,
          seed: settings.seed,
          model_type: settings.model,
          style: settings.style,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json?.error || "Failed to create variation.";
        setMessages((prev) =>
          prev.map((m) => (m.id === typingMsg.id ? { ...m, typing: false, content: msg } : m)),
        );
        return;
      }

      const json = await res.json();
      const newHistoryId = json.historyId || null;

      if (json.type === "image") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === typingMsg.id ? {
              ...m,
              typing: false,
              type: "image",
              imageUrl: json.url,
              settings: json.settings,
              prompt: prompt,
            } : m,
          ),
        );
      }

      if (newHistoryId && !activeHistoryId) {
        setActiveHistoryId(newHistoryId);
      }
      await loadHistoryList();
    } finally {
      setBusy(false);
    }
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

        <div className="flex h-full flex-1 flex-col overflow-hidden">
          <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">AI Image Generator</span>
              <span className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:inline">
                ChatGPT-style UI
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Link href="/explore" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
                Explore
              </Link>
              <Link href="/history" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
                Images
              </Link>
              <Link href="/settings" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
                Settings
              </Link>
              {!authUser && (
                <div className="flex items-center gap-2">
                  <Link href="/login" className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">
                    Login
                  </Link>
                  <Link href="/signup" className="rounded-lg bg-zinc-900 px-3 py-1.5 text-white dark:bg-zinc-100 dark:text-zinc-950">
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </header>

          <ChatWindow messages={messages} />

          <PromptInput onSend={sendPrompt} onEnhance={enhancePrompt} disabled={!canSend} />

          {!isLoggedIn && (
            <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2 text-center text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              Login required to generate images (so your history can be saved).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
