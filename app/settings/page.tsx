"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("theme");
    return (
      saved === "dark" ||
      (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Link
          href="/"
          className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Back
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Dark mode</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Toggle between light and dark theme.
            </p>
          </div>
          <button
            type="button"
            onClick={toggle}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {dark ? "On" : "Off"}
          </button>
        </div>
      </div>
    </main>
  );
}

