"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTheme } from "../../components/ThemeProvider";
import { PageHeader } from "../../components/PageHeader";
import { PageTransition } from "../../components/PageTransition";
import { Moon, Sun, Palette, Type, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

const SIZE_OPTIONS = [
  { label: "512 x 512", width: 512, height: 512 },
  { label: "768 x 768", width: 768, height: 768 },
  { label: "1024 x 1024", width: 1024, height: 1024 },
];

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  const [defaultSize, setDefaultSize] = useState(() => {
    if (typeof window === "undefined") return "1024 x 1024";
    return localStorage.getItem("defaultSize") ?? "1024 x 1024";
  });
  const [defaultModel, setDefaultModel] = useState(() => {
    if (typeof window === "undefined") return "flux";
    return localStorage.getItem("defaultModel") ?? "flux";
  });

  const saveSize = (label: string) => {
    setDefaultSize(label);
    localStorage.setItem("defaultSize", label);
    toast.success(`Default size set to ${label}`);
  };

  const saveModel = (model: string) => {
    setDefaultModel(model);
    localStorage.setItem("defaultModel", model);
    toast.success("Default model updated");
  };

  const handleThemeToggle = () => {
    toggle();
    toast.success(`${isDark ? "Light" : "Dark"} mode enabled`);
  };

  return (
    <main className="min-h-screen w-full">
      <PageHeader
        title="Settings"
        subtitle="Manage your preferences"
        onBack={() => router.push("/")}
      />

      <PageTransition>
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        <div className="space-y-4">
          {/* Appearance */}
          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <Palette className="h-4 w-4 text-indigo-500" />
              <h2 className="font-heading text-sm font-semibold text-zinc-800 dark:text-zinc-100">Appearance</h2>
            </div>
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-indigo-600 dark:text-indigo-400">
                  {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">Dark mode</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Toggle between light and dark theme.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isDark}
                onClick={handleThemeToggle}
                className={[
                  "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300",
                  isDark ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-700",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-all duration-300",
                    isDark ? "left-6" : "left-1",
                  ].join(" ")}
                />
              </button>
            </div>
          </section>

          {/* Generation defaults */}
          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <SlidersHorizontal className="h-4 w-4 text-indigo-500" />
              <h2 className="font-heading text-sm font-semibold text-zinc-800 dark:text-zinc-100">Image Generation Defaults</h2>
            </div>
            <div className="space-y-5 p-5">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Default size</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Used when opening the generator.
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {SIZE_OPTIONS.map((size) => (
                    <button
                      key={size.label}
                      type="button"
                      onClick={() => saveSize(size.label)}
                      className={[
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        defaultSize === size.label
                          ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                          : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
                      ].join(" ")}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Default model</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Model used for new generations.
                  </p>
                </div>
                <select
                  value={defaultModel}
                  onChange={(e) => saveModel(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <optgroup label="Image Models">
                    <option value="flux">FLUX.1 Schnell</option>
                    <option value="flux-realism">FLUX Realism</option>
                    <option value="flux-anime">FLUX Anime</option>
                    <option value="flux-3d">FLUX 3D</option>
                    <option value="turbo">Turbo</option>
                  </optgroup>
                  <optgroup label="Text Models">
                    <option value="openai">OpenAI GPT</option>
                    <option value="mistral">Mistral</option>
                    <option value="claude">Claude</option>
                  </optgroup>
                </select>
              </div>
            </div>
          </section>

          {/* About */}
          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <Type className="h-4 w-4 text-indigo-500" />
              <h2 className="font-heading text-sm font-semibold text-zinc-800 dark:text-zinc-100">About</h2>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Version</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">0.1.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Engine</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">Pollinations AI</span>
              </div>
            </div>
          </section>
        </div>
      </div>
      </PageTransition>
    </main>
  );
}