"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const MODEL_OPTIONS = [
  { label: "Stable Diffusion v1.5", value: "runwayml/stable-diffusion-v1-5" },
  { label: "Stable Diffusion XL", value: "stabilityai/stable-diffusion-xl-base-1.0" },
  { label: "Flux Schnell", value: "black-forest-labs/FLUX.1-schnell" },
  { label: "Custom", value: "__custom__" },
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(MODEL_OPTIONS[0].value);
  const [customModel, setCustomModel] = useState("");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);

  const effectiveModel = model === "__custom__" ? customModel.trim() : model;

  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image);
    };
  }, [image]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) {
          setCurrentUser(null);
          return;
        }
        const json = await res.json();
        setCurrentUser(json?.user || null);
      } catch {
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    loadUser();
  }, []);

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt.");
      return;
    }

    if (!effectiveModel) {
      setError("Please select or enter a Hugging Face model.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model: effectiveModel }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => null);
        const status = res.status;
        const baseMessage = errorJson?.error || `Failed to generate image: ${res.status} ${res.statusText}`;
        const detailsValue = errorJson?.details;
        const details =
          detailsValue !== undefined && detailsValue !== null
            ? `\nDetails: ${typeof detailsValue === "string" ? detailsValue : JSON.stringify(detailsValue)}`
            : "";
        setError(`${baseMessage} (status ${status})${details}`);
        setImage("");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setImage((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch {
      setError("Network error while generating image.");
      setImage("");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Portfolio Project</p>
            <h1 className="text-lg font-semibold">AI Image Generator</h1>
          </div>
          <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-300">
            <a href="#generator" className="hover:text-zinc-900 dark:hover:text-white">Generator</a>
            <a href="#result" className="hover:text-zinc-900 dark:hover:text-white">Result</a>
            <Link href="/history" className="hover:text-zinc-900 dark:hover:text-white">History</Link>
            {!authLoading && !currentUser && (
              <>
                <Link href="/login" className="hover:text-zinc-900 dark:hover:text-white">Login</Link>
                <Link href="/signup" className="hover:text-zinc-900 dark:hover:text-white">Signup</Link>
              </>
            )}
            {!authLoading && currentUser && (
              <>
                <span className="max-w-40 truncate text-zinc-800 dark:text-zinc-200">{currentUser.name}</span>
                <button
                  onClick={logout}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Logout
                </button>
              </>
            )}
            <a
              href="https://github.com/"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6 py-10">
        <section id="generator" className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-2xl font-bold">Create AI Artwork</h2>
          <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
            Enter your prompt, select a model, and generate a unique image using Hugging Face inference.
          </p>

          <input
            type="text"
            placeholder="Enter prompt..."
            className="mb-4 w-full rounded border border-zinc-300 p-3 dark:border-zinc-700 dark:bg-zinc-950"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium">Model</label>
            <select
              className="mb-3 w-full rounded border border-zinc-300 p-3 dark:border-zinc-700 dark:bg-zinc-950"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {model === "__custom__" && (
              <input
                type="text"
                placeholder="e.g. stabilityai/stable-diffusion-3.5-large"
                className="w-full rounded border border-zinc-300 p-3 dark:border-zinc-700 dark:bg-zinc-950"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
              />
            )}
          </div>

          <button
            onClick={generateImage}
            className="rounded bg-black px-6 py-3 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate Image"}
          </button>

          {error && (
            <div className="mt-4 whitespace-pre-wrap font-medium text-red-600">{error}</div>
          )}
        </section>

        {image && (
          <section id="result" className="mt-8 w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-4 text-lg font-semibold">Generated Result</h3>
            <Image
              src={image}
              alt="Generated image"
              width={512}
              height={512}
              unoptimized
              className="w-full rounded-lg shadow"
            />
          </section>
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-5 text-sm text-zinc-600 dark:text-zinc-400 md:flex-row md:items-center md:justify-between">
          <p>Built with Next.js + Hugging Face Inference</p>
          <p>
            Designed for GitHub portfolio showcase by <span className="font-medium text-zinc-800 dark:text-zinc-200">Kanha Jatthap</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
