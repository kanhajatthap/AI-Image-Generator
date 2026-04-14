"use client";

const STYLE_OPTIONS = [
  { value: "", label: "Select a style...", suffix: "" },
  { value: "realistic", label: "Realistic", suffix: "realistic style, photorealistic, ultra detailed, 8k quality" },
  { value: "anime", label: "Anime", suffix: "anime style, manga art, vibrant colors, cel shading, studio ghibli inspired" },
  { value: "cyberpunk", label: "Cyberpunk", suffix: "cyberpunk style, neon lights, futuristic city, high tech, dystopian atmosphere" },
  { value: "pixar", label: "Pixar style", suffix: "pixar style, 3d animation, cute character, colorful, family friendly, disney quality" },
  { value: "3d render", label: "3D render", suffix: "3d render, octane render, blender, c4d, photorealistic materials, studio lighting" },
  { value: "fantasy", label: "Fantasy art", suffix: "fantasy art style, magical atmosphere, ethereal lighting, highly detailed, concept art quality" },
];

interface StylePresetsProps {
  onApply: (suffix: string) => void;
  value?: string;
}

export function StylePresets({ onApply, value }: StylePresetsProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="text-zinc-500 dark:text-zinc-400">Style:</label>
      <select
        value={value || ""}
        onChange={(e) => {
          const selected = STYLE_OPTIONS.find((s) => s.value === e.target.value);
          if (selected?.suffix) {
            onApply(selected.suffix);
          }
        }}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
      >
        {STYLE_OPTIONS.map((style) => (
          <option key={style.value} value={style.value}>
            {style.label}
          </option>
        ))}
      </select>
    </div>
  );
}
