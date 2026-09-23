"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Pin,
  Star,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
  LogOut,
  LogIn,
  UserPlus,
  Home,
  Images,
  Compass,
  Settings,
  Info,
} from "lucide-react";

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
  className,
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
  className?: string;
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
    <aside className={`${className ?? "hidden md:flex"} h-screen w-[280px] shrink-0 border-r border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50 md:flex-col`}>
      <button
        type="button"
        onClick={onNewChat}
        className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/30"
      >
        <Plus className="h-4 w-4" />
        New Chat
      </button>

      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">History</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{items.length}</span>
      </div>

      <div className="sidebar-scroll flex-1 space-y-1.5 overflow-y-auto">
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center dark:border-zinc-700">
            <MessageSquare className="mx-auto h-6 w-6 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">No conversations yet</p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-600">
              Start a new chat and your generations will appear here.
            </p>
          </div>
        )}
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
                  "w-full rounded-xl px-3 py-2.5 pr-10 text-left text-sm transition-all duration-200",
                  active
                    ? "bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100 dark:from-indigo-950/50 dark:to-purple-950/50 dark:text-indigo-300 dark:ring-indigo-800/30"
                    : "hover:bg-gray-50 hover:shadow-sm dark:hover:bg-zinc-900/50",
                ].join(" ")}
                title={label}
              >
                <div className="flex items-center gap-2">
                  {item.pinned ? (
                    <Star className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  )}

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
                      className="h-6 w-full rounded-md border border-gray-200 bg-white px-2 text-sm font-medium text-zinc-900 outline-none ring-2 ring-indigo-500/20 focus:border-indigo-500 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  ) : (
                    <div className="line-clamp-1 font-medium text-zinc-700 dark:text-zinc-200">{label}</div>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                  {new Date(item.createdAt).toLocaleDateString()}
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
                    <MoreHorizontal className="h-4 w-4" />
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
                          <Pin className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
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
                          <Pencil className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
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
                          <Trash2 className="h-4 w-4" />
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
          <Link href="/" className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            <Home className="h-4 w-4 text-zinc-400" />
            Home
          </Link>
          <Link href="/explore" className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            <Compass className="h-4 w-4 text-zinc-400" />
            Explore
          </Link>
          <Link href="/history" className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            <Images className="h-4 w-4 text-zinc-400" />
            Images
          </Link>
          <Link href="/settings" className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            <Settings className="h-4 w-4 text-zinc-400" />
            Settings
          </Link>
          <Link href="/about" className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            <Info className="h-4 w-4 text-zinc-400" />
            About this project
          </Link>
        </nav>
        {!authUser && (
          <div className="mt-2 flex flex-col gap-1 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <LogIn className="h-4 w-4" />
              Login
            </Link>
            <Link
              href="/signup"
              className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30"
            >
              <UserPlus className="h-4 w-4" />
              Sign up
            </Link>
          </div>
        )}
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
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      )}
    </aside>
  );
}

