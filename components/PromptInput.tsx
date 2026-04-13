"use client";

import { KeyboardEvent, useState } from "react";

export function PromptInput({
  onSend,
  disabled,
}: {
  onSend: (prompt: string) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  const send = async () => {
    const prompt = value.trim();
    if (!prompt) return;
    setValue("");
    await onSend(prompt);
  };

  const onKeyDown = async (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !disabled) {
      e.preventDefault();
      await send();
    }
  };

  return (
    <div className="border-t border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex w-full max-w-3xl gap-3 px-4 py-4">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message AI Image Generator… (Enter to send, Shift+Enter for new line)"
          className="min-h-[48px] max-h-40 flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
          disabled={disabled}
        />
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
  );
}

