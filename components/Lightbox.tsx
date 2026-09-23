"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Copy, Check, Download, ChevronLeft, ChevronRight, X, FileText, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { toast } from "sonner";

export interface LightboxItem {
  url: string;
  prompt: string;
  seed?: number;
}

interface LightboxProps {
  items: LightboxItem[];
  index: number | null;
  onClose: () => void;
}

const FILENAME_SAFE = (p: string) =>
  p
    .trim()
    .slice(0, 40)
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase() || "generated";

const MAX_ZOOM = 4;
const MIN_ZOOM = 1;

function LightboxMedia({ url, onLoaded }: { url: string; onLoaded: () => void }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const isPdf = url.toLowerCase().startsWith("data:application/pdf");

  if (isPdf) {
    return (
      <iframe
        src={url}
        title="Generated document"
        className="h-[80vh] w-full max-w-[90vw] rounded-xl bg-white"
      />
    );
  }

  return (
    <div className="relative flex items-center justify-center">
      {state === "loading" && (
        <div className="absolute flex h-12 w-12 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
        </div>
      )}
      <img
        src={url}
        alt="Preview"
        className={[
          "max-h-[80vh] max-w-[92vw] rounded-xl object-contain shadow-2xl transition-opacity duration-300",
          state === "ok" ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onLoad={() => {
          setState("ok");
          onLoaded();
        }}
        onError={() => setState("error")}
        draggable={false}
      />
      {state === "error" && <p className="text-sm text-white/60">Failed to load image.</p>}
    </div>
  );
}

export function Lightbox({ items, index, onClose }: LightboxProps) {
  const [current, setCurrent] = useState(() => index ?? 0);
  const [prevIndex, setPrevIndex] = useState(index);
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const mediaRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<{ startX: number; startY: number; originX: number; originY: number; panning: boolean } | null>(null);

  // Adjust state during render when the open index changes (avoids effect cascade)
  if (index !== prevIndex) {
    setPrevIndex(index);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (index !== null) {
      setCurrent(Math.max(0, Math.min(index, items.length - 1)));
    }
  }

  const item = useMemo(
    () => (items.length > 0 && index !== null ? items[current] : null),
    [items, current, index],
  );

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  const navigate = useCallback(
    (delta: number) => {
      if (items.length <= 1) return;
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setCurrent((prev) => (prev + delta + items.length) % items.length);
    },
    [items.length],
  );

  const clampZoom = useCallback((z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)), []);

  // Wheel zoom (non-passive so page zoom is prevented)
  useEffect(() => {
    if (index === null) return;
    const el = mediaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => clampZoom(z + (e.deltaY < 0 ? 0.2 : -0.2)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [index, clampZoom]);

  // Keyboard navigation + scroll lock
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") navigate(1);
      if (e.key === "ArrowLeft") navigate(-1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, close, navigate]);

  // Reset zoom whenever lightbox closes (handled via render-guard above)

  const download = () => {
    if (!item) return;
    const a = document.createElement("a");
    a.href = item.url;
    a.download = `${FILENAME_SAFE(item.prompt)}.png`;
    a.click();
    toast.success("Downloading image");
  };

  const copyPrompt = async () => {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(item.prompt);
      setCopied(true);
      toast.success("Prompt copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy prompt");
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!item) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    gestureRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: pan.x,
      originY: pan.y,
      panning: zoom > 1,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (zoom > 1) {
      setPan({ x: g.originX + dx, y: g.originY + dy });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (zoom <= 1 && (Math.abs(dx) > 70 || Math.abs(dy) > 70) && Math.abs(dx) > Math.abs(dy)) {
      navigate(dx < 0 ? 1 : -1);
      return;
    }
    if (zoom <= 1) {
      setPan({ x: 0, y: 0 });
    }
  };

  const toggleZoom = () => {
    setZoom((z) => (z > 1 ? 1 : 2.5));
    setPan({ x: 0, y: 0 });
  };

  const zoomLabel = zoom === 1 ? "Fit" : `${Math.round(zoom * 100)}%`;

  return (
    <AnimatePresence>
      {index !== null && item && (
        <motion.div
          key="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-3">
            {items.length > 1 ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
                {current + 1} / {items.length}
              </span>
            ) : item.seed !== undefined ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-mono text-white/60">
                Seed: {item.seed}
              </span>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-1">
              {item.url.toLowerCase().startsWith("data:application/pdf") && (
                <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70">
                  <FileText className="h-3.5 w-3.5" /> Document
                </span>
              )}
              <div className="mx-2 flex items-center gap-0.5 rounded-full border border-white/10 bg-white/5 px-2 py-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => clampZoom(z - 0.25))}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  title="Zoom out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleZoom}
                  className="w-10 text-center text-xs font-medium tabular-nums text-white/70"
                  title="Reset zoom"
                >
                  {zoomLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => clampZoom(z + 0.25))}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  title="Zoom in"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                {zoom > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    title="Reset zoom"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowPrompt((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                title={showPrompt ? "Hide prompt" : "Show prompt"}
              >
                <FileText className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={close}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                title="Close (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Media */}
          <div
            ref={mediaRef}
            className="relative flex flex-1 touch-none items-center justify-center overflow-hidden px-4 pb-4 select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDoubleClick={toggleZoom}
          >
            {items.length > 1 && zoom === 1 && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="absolute left-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
                title="Previous (←)"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            <motion.div
              className="flex items-center justify-center"
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
            >
              <LightboxMedia
                key={item.url}
                url={item.url}
                onLoaded={() => {
                  setCopied(false);
                  setShowPrompt(false);
                }}
              />
            </motion.div>
            {items.length > 1 && zoom === 1 && (
              <button
                type="button"
                onClick={() => navigate(1)}
                className="absolute right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
                title="Next (→)"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Prompt + actions */}
          <div className="mx-auto w-full max-w-3xl px-6 pb-6">
            {showPrompt && (
              <div className="mb-3 max-h-32 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-white/80 backdrop-blur animate-reveal-up">
                {item.prompt}
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="line-clamp-1 flex-1 text-sm text-white/60">{item.prompt}</p>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={copyPrompt}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copied" : "Copy prompt"}
                </button>
                <button
                  type="button"
                  onClick={download}
                  className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white/90"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}