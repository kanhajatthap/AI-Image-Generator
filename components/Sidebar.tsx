"use client";

import Link from "next/link";

export type HistoryListItem = {
  id: string;
  prompt: string;
  createdAt: string;
};

export function Sidebar({
  items,
  activeId,
  onNewChat,
  onSelect,
}: {
  items: HistoryListItem[];
  activeId: string | null;
  onNewChat: () => void;
  onSelect: (id: string) => void;
}) {
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

      <div className="flex-1 overflow-y-auto space-y-1">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={[
                "w-full rounded-lg px-3 py-2 text-left text-sm",
                active
                  ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-900",
              ].join(" ")}
              title={item.prompt}
            >
              <div className="line-clamp-1 font-medium">{item.prompt || "Untitled"}</div>
              <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                {new Date(item.createdAt).toLocaleString()}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">
        <nav className="flex flex-col gap-1">
          <Link href="/" className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            Home
          </Link>
          <Link href="/history" className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            History
          </Link>
          <Link href="/settings" className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900">
            Settings
          </Link>
        </nav>
      </div>
    </aside>
  );
}

