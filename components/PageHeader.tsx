"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Moon, Sun, Home, Compass, Images, Settings, BrainCircuit, Search, Info } from "lucide-react";
import { useTheme } from "./ThemeProvider";

const NAV_ITEMS = [
  { href: "/", label: "Creator", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/history", label: "Images", icon: Images },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/about", label: "About", icon: Info },
];

export function PageHeader({
  title,
  subtitle,
  onBack,
  actions,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}) {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <Link href="/" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20">
            <BrainCircuit className="h-5 w-5 text-white" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </h1>
            {subtitle && (
              <p className="hidden truncate text-xs text-zinc-500 dark:text-zinc-400 sm:block">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 dark:from-indigo-950/60 dark:to-purple-950/60 dark:text-indigo-300"
                      : "text-zinc-600 hover:bg-gray-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white",
                  ].join(" ")}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("palette:open"))}
            className="group flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 transition-all duration-200 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title="Search (Ctrl+K)"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 transition-all duration-200 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {actions}
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-zinc-200/60 px-4 py-1.5 md:hidden dark:border-zinc-800/60">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 dark:from-indigo-950/60 dark:to-purple-950/60 dark:text-indigo-300"
                  : "text-zinc-600 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
              ].join(" ")}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}