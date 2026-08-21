"use client";

import { KeyboardEvent, useState, useRef, DragEvent, useEffect, ClipboardEvent, ChangeEvent } from "react";
import { ImageSettings, ImageSettingsState } from "./ImageSettings";
import { StylePresets } from "./StylePresets";
import { PromptTemplates } from "./PromptTemplates";

export interface PromptInputOptions {
  prompt: string;
  width: number;
  height: number;
  seed?: number;
  model: string;
  image?: File;
  batchCount?: number;
}

interface PromptInputProps {
  onSend: (options: PromptInputOptions) => Promise<void> | void;
  onEnhance?: (prompt: string) => Promise<string>;
  onOCRResult?: (text: string) => void;
  disabled?: boolean;
}

const ACCEPTED_FORMATS = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXTAREA_LINES = 7;
const LINE_HEIGHT = 24;

const DEFAULT_SETTINGS: ImageSettingsState = {
  width: 1024,
  height: 1024,
  model: "flux",
};

export function PromptInput({ onSend, onEnhance, onOCRResult, disabled }: PromptInputProps) {
  const [value, setValue] = useState("");
  const [settings, setSettings] = useState<ImageSettingsState>(DEFAULT_SETTINGS);
  const [templateValue, setTemplateValue] = useState("");
  const [styleValue, setStyleValue] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [textareaHeight, setTextareaHeight] = useState(24);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(4);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const newHeight = Math.min(
      Math.max(textarea.scrollHeight, LINE_HEIGHT),
      LINE_HEIGHT * MAX_TEXTAREA_LINES
    );
    textarea.style.height = `${newHeight}px`;
    setTextareaHeight(newHeight);
  }, [value]);

  // Fetch prompt suggestions
  useEffect(() => {
    if (!value.trim() || value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/prompt-history?q=${encodeURIComponent(value.trim())}&limit=5`);
        if (res.ok) {
          const json = await res.json();
          const filtered = (json.prompts || []).filter((p: string) => p !== value.trim());
          setSuggestions(filtered);
          setShowSuggestions(filtered.length > 0);
          setSelectedSuggestionIndex(-1);
        }
      } catch {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Handle paste from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleImageFile(file);
          }
          return;
        }
      }
    };

    const inputContainer = inputContainerRef.current;
    if (inputContainer) {
      inputContainer.addEventListener("paste", handlePaste as any);
      return () => {
        inputContainer.removeEventListener("paste", handlePaste as any);
      };
    }
  }, []);

  const handleImageFile = (file: File) => {
    if (!ACCEPTED_FORMATS.includes(file.type)) {
      alert("Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert("File too large. Maximum size is 10MB.");
      return;
    }
    setSelectedImage(file);
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDragging(false);
      }
      return newCount;
    });
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file && ACCEPTED_FORMATS.includes(file.type)) {
        if (file.size > MAX_FILE_SIZE) {
          alert("File too large. Maximum size is 10MB.");
          return;
        }
        setSelectedImage(file);
      } else if (file) {
        alert("Please upload a JPG, PNG, or WEBP image.");
      }
    }
  };

  const handleFileSelect = (file: File | null) => {
    if (file) {
      handleImageFile(file);
    }
  };

  const processOCR = async (imageFile: File) => {
    setIsProcessingOCR(true);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("prompt", "Extract all text from this image.");

      const res = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success && json.text) {
        // Call the callback to display extracted text as chat message
        if (onOCRResult) {
          onOCRResult(json.text);
        }
      } else if (json.success && json.text === "No text found in image.") {
        if (onOCRResult) {
          onOCRResult("No text found in the image.");
        }
      } else {
        alert(json.error || "Failed to extract text.");
      }
    } catch (error) {
      console.error("OCR Error:", error);
      alert("Failed to process image.");
    } finally {
      setIsProcessingOCR(false);
      setSelectedImage(null);
    }
  };

  const send = async () => {
    if (selectedImage && !value.trim()) {
      await processOCR(selectedImage);
      return;
    }

    const prompt = value.trim();
    if (!prompt && !selectedImage) return;
    setValue("");
    setTemplateValue("");
    setStyleValue("");
    setShowSuggestions(false);
    await onSend({
      prompt,
      width: settings.width,
      height: settings.height,
      seed: settings.seed,
      model: settings.model,
      image: selectedImage || undefined,
      batchCount: batchMode ? batchCount : undefined,
    });
    setSelectedImage(null);
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
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return;
      }
      if (e.key === "Tab" && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        setValue(suggestions[selectedSuggestionIndex]);
        setShowSuggestions(false);
        return;
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey && !disabled) {
      e.preventDefault();
      setShowSuggestions(false);
      await send();
    }
  };

  const handleTemplateSelect = (templatePrompt: string, templateValue: string) => {
    setValue(templatePrompt);
    setTemplateValue(templateValue);
  };

  const handleStyleApply = (styleSuffix: string, styleVal: string) => {
    const currentPrompt = value.trim();
    if (currentPrompt) {
      setValue(`${currentPrompt}, ${styleSuffix}`);
    } else {
      setValue(styleSuffix);
    }
    setStyleValue(styleVal);
  };

  const randomizeSeed = () => {
    setSettings({ ...settings, seed: Math.floor(Math.random() * 1000000) });
  };

  return (
    <div className="border-t border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      {/* Template and Style Bar */}
      <div className="flex flex-wrap items-center gap-4 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <PromptTemplates onSelect={(prompt) => handleTemplateSelect(prompt, "")} value={templateValue} />
        <StylePresets onApply={(suffix) => handleStyleApply(suffix, "")} value={styleValue} />
      </div>

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
        </div>
        <div className="flex items-center gap-2">
          {/* Batch Mode Toggle */}
          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-700">
            <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={batchMode}
                onChange={(e) => setBatchMode(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              Batch
            </label>
            {batchMode && (
              <select
                value={batchCount}
                onChange={(e) => setBatchCount(parseInt(e.target.value))}
                className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs dark:border-zinc-600 dark:bg-zinc-800"
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n}x</option>
                ))}
              </select>
            )}
          </div>

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

      {/* Input Container with Drag & Drop */}
      <div 
        ref={inputContainerRef}
        className="mx-auto max-w-3xl px-4 py-4"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag Overlay */}
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-blue-500 bg-blue-50/90 dark:bg-blue-950/50">
            <div className="flex flex-col items-center gap-2">
              <svg className="h-12 w-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Drop image here</p>
            </div>
          </div>
        )}

        {/* Image Preview Card */}
        {selectedImage && (
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
              <img
                src={URL.createObjectURL(selectedImage)}
                alt="Preview"
                className="h-full w-full object-cover"
              />
              {isProcessingOCR && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <p className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {selectedImage.name}
              </p>
              <p className="text-xs text-zinc-500">
                {(selectedImage.size / 1024).toFixed(1)} KB
              </p>
              <div className="mt-1 flex gap-2">
                <button
                  onClick={() => processOCR(selectedImage)}
                  disabled={isProcessingOCR}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isProcessingOCR ? "Processing..." : "Extract Text"}
                </button>
                <button
                  onClick={() => setSelectedImage(null)}
                  disabled={isProcessingOCR}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ChatGPT-style Premium Input Container */}
        <div className="mx-auto w-full max-w-3xl">
          {/* Autocomplete Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div ref={suggestionsRef} className="mb-2 rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    setValue(suggestion);
                    setShowSuggestions(false);
                  }}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                    index === selectedSuggestionIndex
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <svg className="h-4 w-4 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span className="truncate text-zinc-700 dark:text-zinc-300">{suggestion}</span>
                </button>
              ))}
              <div className="border-t border-zinc-100 px-4 py-1.5 text-[10px] text-zinc-400 dark:border-zinc-800">
                Tab to select · Esc to close
              </div>
            </div>
          )}

          <div className={`relative flex items-end rounded-2xl border border-gray-700/50 bg-zinc-800/50 shadow-lg shadow-black/10 backdrop-blur-sm transition-all duration-200 dark:border-zinc-600/30 dark:bg-zinc-900/80 ${isDragging ? "border-indigo-500 ring-2 ring-indigo-500/20" : ""}`}>
            {/* Image Upload Button (+) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              id="image-upload"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            />
            <label
              htmlFor="image-upload"
              className="cursor-pointer ml-3 mb-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-700/50 text-zinc-400 transition-all duration-200 hover:bg-zinc-600/60 hover:text-zinc-200 dark:bg-zinc-700/40 dark:text-zinc-500 dark:hover:bg-zinc-600/50 dark:hover:text-zinc-300"
              title="Add image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
            </label>

            {/* Auto-expanding Textarea */}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={selectedImage ? "Add a message..." : "Message AI Image Generator..."}
              className="max-h-[200px] min-h-[50px] flex-1 resize-none bg-transparent py-4 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-all dark:text-zinc-100"
              style={{ height: textareaRef.current?.style.height }}
              disabled={disabled}
              rows={1}
            />

            {/* Send Button (Circular Arrow) */}
            <button
              type="button"
              onClick={send}
              disabled={disabled || (!value.trim() && !selectedImage)}
              className="mb-2 mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-md disabled:hover:shadow-indigo-500/25"
              title="Send message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            </button>
          </div>

          <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-500">
            AI Image Generator can make mistakes. Consider checking important information.
          </p>
        </div>
      </div>
    </div>
  );
}

