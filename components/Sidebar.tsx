"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export type HistoryListItem = {
  id: string;
  prompt: string;
  title?: string;
  pinned?: boolean;
  createdAt: string;
};

export function Sidebar({
  items,
  activeId,
  onNewChat,
  onSelect,
  onDelete,
  onRename,
  onTogglePin,
  authUser,
  onLogout,
}: {
  items: HistoryListItem[];
  activeId: string | null;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  onTogglePin?: (id: string) => void;
  authUser: { name: string; email: string } | null;
  onLogout?: () => void;
}) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const itemById = useMemo(() => {
    const m = new Map<string, HistoryListItem>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  useEffect(() => {
    if (!editingId) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [editingId]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-sidebar-menu='true']")) return;
      setMenuOpenId(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const startRename = (id: string) => {
    const it = itemById.get(id);
    const label = it?.title || it?.prompt || "";
    setDraftTitle(label);
    setEditingId(id);
    setMenuOpenId(null);
  };

  const commitRename = () => {
    if (!editingId || !onRename) return;
    const title = draftTitle.trim();
    onRename(editingId, title);
    setEditingId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
  };

  return (
    <aside className="hidden h-screen w-[300px] shrink-0 border-r border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950 md:flex md:flex-col">
      <button
        type="button"
        onClick={onNewChat}
        className="mb-3 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:opacity-95 dark:bg-zinc-100 dark:text-zinc-950"
      >
        + New Chat
      </button>

      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        <span className="uppercase tracking-wider">History</span>
        <span className="text-[11px]">({items.length})</span>
      </div>

      <div className="sidebar-scroll flex-1 overflow-y-auto space-y-1">
        {items.map((item) => {
          const active = item.id === activeId;
          const label = item.title || item.prompt || "Untitled";
          const isEditing = editingId === item.id;
          return (
            <div key={item.id} className="group relative">
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className={[
                  "w-full rounded-lg px-3 py-2 pr-10 text-left text-sm",
                  active
                    ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-900",
                ].join(" ")}
                title={label}
              >
                <div className="flex items-center gap-2">
                  {item.pinned ? (
                    <svg
                      className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 17v5" />
                      <path d="M8 3h8l1 6-5 5h-2L7 9l1-6Z" />
                    </svg>
                  ) : null}

                  {isEditing ? (
                    <input
                      ref={inputRef}
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") cancelRename();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="h-6 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm font-medium text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-zinc-600"
                    />
                  ) : (
                    <div className="line-clamp-1 font-medium">{label}</div>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {new Date(item.createdAt).toLocaleString()}
                </div>
              </button>

              {(onDelete || onRename || onTogglePin) && (
                <div data-sidebar-menu="true" className="absolute right-2 top-2">
                  <button
                    type="button"
                    aria-label="Conversation options"
                    title="Options"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuOpenId((prev) => (prev === item.id ? null : item.id));
                    }}
                    className={[
                      "rounded-md p-1",
                      "text-zinc-400 hover:text-zinc-700 hover:bg-white",
                      "opacity-0 group-hover:opacity-100",
                      "dark:hover:bg-zinc-950 dark:hover:text-zinc-200",
                    ].join(" ")}
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <circle cx="5" cy="12" r="1.6" />
                      <circle cx="12" cy="12" r="1.6" />
                      <circle cx="19" cy="12" r="1.6" />
                    </svg>
                  </button>

                  {menuOpenId === item.id && (
                    <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                      {onTogglePin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenuOpenId(null);
                            onTogglePin(item.id);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          <svg
                            className="h-4 w-4 text-zinc-500 dark:text-zinc-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 17v5" />
                            <path d="M8 3h8l1 6-5 5h-2L7 9l1-6Z" />
                          </svg>
                          {item.pinned ? "Unpin" : "Pin"}
                        </button>
                      )}

                      {onRename && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            startRename(item.id);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          <svg
                            className="h-4 w-4 text-zinc-500 dark:text-zinc-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                          Rename
                        </button>
                      )}

                      {onDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenuOpenId(null);
                            onDelete(item.id);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M6 6l1 16h10l1-16" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                          </svg>
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">
        <nav className="flex flex-col gap-1">
          <Link href="/" className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            Home
          </Link>
          <Link href="/explore" className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            Explore
          </Link>
          <Link href="/history" className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            Images
          </Link>
          <Link href="/settings" className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            Settings
          </Link>
        </nav>
      </div>

      {authUser && onLogout && (
        <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-950">
              {authUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {authUser.name}
              </span>
              <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {authUser.email}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white cursor-pointer"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Logout
          </button>
        </div>
      )}
    </aside>
  );
}

