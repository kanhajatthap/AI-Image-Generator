 "use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sidebar, type HistoryListItem } from "../components/Sidebar";
import { ChatWindow } from "../components/ChatWindow";
import type { ChatMessageModel } from "../components/ChatMessage";
import { PromptInput } from "../components/PromptInput";

const DEFAULT_MODEL = "black-forest-labs/FLUX.1-schnell";

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Home() {
  const [history, setHistory] = useState<HistoryListItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageModel[]>([]);
  const [busy, setBusy] = useState(false);
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
    const items: Array<{ id: string; prompt: string; createdAt: string }> = Array.isArray(json?.items)
      ? json.items
      : [];
    setHistory(
      items.map((x) => ({
        id: x.id,
        prompt: x.prompt,
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

  const canSend = useMemo(() => isLoggedIn && !busy, [isLoggedIn, busy]);

  const sendPrompt = async (prompt: string) => {
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
        body: JSON.stringify({ prompt, model: DEFAULT_MODEL }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json?.error || "Failed to generate image.";
        setMessages((prev) =>
          prev.map((m) => (m.id === typingMsg.id ? { ...m, typing: false, content: msg } : m)),
        );
        return;
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === typingMsg.id ? { ...m, typing: false, content: json.text } : m,
          ),
        );
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === typingMsg.id ? { ...m, typing: false, imageUrl: url } : m,
          ),
        );
      }

      // Refresh sidebar history (new item created server-side in /api/generate)
      await loadHistoryList();
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthUser(null);
    newChat();
  };

  return (
    <div className="h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex h-full">
        <Sidebar
          items={history}
          activeId={activeHistoryId}
          onNewChat={newChat}
          onSelect={openHistory}
        />

        <div className="flex h-full flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">AI Image Generator</span>
              <span className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:inline">
                ChatGPT-style UI
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Link href="/history" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
                History
              </Link>
              <Link href="/settings" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
                Settings
              </Link>
              {!authUser ? (
                <div className="flex items-center gap-2">
                  <Link href="/login" className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">
                    Login
                  </Link>
                  <Link href="/signup" className="rounded-lg bg-zinc-900 px-3 py-1.5 text-white dark:bg-zinc-100 dark:text-zinc-950">
                    Sign up
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="max-w-40 truncate text-xs text-zinc-600 dark:text-zinc-300">{authUser.name}</span>
                  <button
                    type="button"
                    onClick={logout}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </header>

          <ChatWindow messages={messages} onDeleteHistory={deleteHistory} />

          <PromptInput onSend={sendPrompt} disabled={!canSend} />

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
