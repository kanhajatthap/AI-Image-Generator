"use client";

const STYLE_OPTIONS = [
  { value: "none", label: "No Style" },
  { value: "realistic", label: "Realistic" },
  { value: "anime", label: "Anime" },
  { value: "cyberpunk", label: "Cyberpunk" },
  { value: "pixar", label: "Pixar" },
  { value: "3d render", label: "3D Render" },
  { value: "watercolor", label: "Watercolor" },
];

interface StylePresetsProps {
  selectedStyle: string;
  onChange: (style: string) => void;
}

export function StylePresets({ selectedStyle, onChange }: StylePresetsProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm">
      <label className="text-zinc-500 dark:text-zinc-400">Style:</label>
      <select
        value={selectedStyle}
        onChange={(e) => onChange(e.target.value)}
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
