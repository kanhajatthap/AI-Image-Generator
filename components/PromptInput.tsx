"use client";

import { KeyboardEvent, useState } from "react";
import { ImageSettings, ImageSettingsState } from "./ImageSettings";
import { StylePresets } from "./StylePresets";
import { PromptTemplates } from "./PromptTemplates";

export interface PromptInputOptions {
  prompt: string;
  width: number;
  height: number;
  seed?: number;
  model: string;
  style: string;
}

interface PromptInputProps {
  onSend: (options: PromptInputOptions) => Promise<void> | void;
  onEnhance?: (prompt: string) => Promise<string>;
  disabled?: boolean;
}

const DEFAULT_SETTINGS: ImageSettingsState = {
  width: 1024,
  height: 1024,
  model: "flux",
};

export function PromptInput({ onSend, onEnhance, disabled }: PromptInputProps) {
  const [value, setValue] = useState("");
  const [settings, setSettings] = useState<ImageSettingsState>(DEFAULT_SETTINGS);
  const [style, setStyle] = useState("none");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const send = async () => {
    const prompt = value.trim();
    if (!prompt) return;
    setValue("");
    await onSend({
      prompt,
      width: settings.width,
      height: settings.height,
      seed: settings.seed,
      model: settings.model,
      style,
    });
  };

  const handleEnhance = async () => {
    const prompt = value.trim();
    if (!prompt || !onEnhance || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const enhanced = await onEnhance(prompt);
      setValue(enhanced);
    } finally {
      setIsEnhancing(false);
    }
  };

  const onKeyDown = async (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !disabled) {
      e.preventDefault();
      await send();
    }
  };

  const handleTemplateSelect = (templatePrompt: string) => {
    setValue(templatePrompt);
  };

  const randomizeSeed = () => {
    setSettings({ ...settings, seed: Math.floor(Math.random() * 1000000) });
  };

  return (
    <div className="border-t border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      {/* Prompt Templates */}
      <PromptTemplates onSelect={handleTemplateSelect} />

      {/* Settings Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
          <StylePresets selectedStyle={style} onChange={setStyle} />
        </div>
        <div className="flex items-center gap-2">
          {onEnhance && (
            <button
              type="button"
              onClick={handleEnhance}
              disabled={disabled || isEnhancing || !value.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {isEnhancing ? "Enhancing..." : "Enhance"}
            </button>
          )}
        </div>
      </div>

      {/* Expandable Settings Panel */}
      {showSettings && (
        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <ImageSettings settings={settings} onChange={setSettings} />
        </div>
      )}

      {/* Main Input */}
      <div className="mx-auto flex w-full max-w-3xl gap-3 px-4 py-4">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message AI Image Generator… (Enter to send, Shift+Enter for new line)"
          className="min-h-[48px] max-h-40 flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
          disabled={disabled}
        />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={randomizeSeed}
            disabled={disabled}
            className="h-[48px] w-[48px] shrink-0 rounded-xl border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
            title="Randomize Seed"
          >
            <svg className="mx-auto h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            type="button"
            onClick={send}
            disabled={disabled || !value.trim()}
            className="h-[48px] shrink-0 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

