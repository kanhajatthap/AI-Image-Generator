"use client";

export interface ImageSettingsState {
  width: number;
  height: number;
  seed?: number;
  model: string;
}

interface ImageSettingsProps {
  settings: ImageSettingsState;
  onChange: (settings: ImageSettingsState) => void;
}

const SIZE_OPTIONS = [
  { label: "512 x 512", width: 512, height: 512 },
  { label: "768 x 768", width: 768, height: 768 },
  { label: "1024 x 1024", width: 1024, height: 1024 },
];

export function ImageSettings({ settings, onChange }: ImageSettingsProps) {
  const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = SIZE_OPTIONS.find((s) => s.label === e.target.value);
    if (size) {
      onChange({ ...settings, width: size.width, height: size.height });
    }
  };

  const currentSizeLabel =
    SIZE_OPTIONS.find((s) => s.width === settings.width && s.height === settings.height)?.label ||
    "1024 x 1024";

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
      {/* Image Size */}
      <div className="flex items-center gap-2">
        <label className="text-zinc-500 dark:text-zinc-400">Size:</label>
        <select
          value={currentSizeLabel}
          onChange={handleSizeChange}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
        >
          {SIZE_OPTIONS.map((size) => (
            <option key={size.label} value={size.label}>
              {size.label}
            </option>
          ))}
        </select>
      </div>

      {/* Seed */}
      <div className="flex items-center gap-2">
        <label className="text-zinc-500 dark:text-zinc-400">Seed:</label>
        <input
          type="number"
          placeholder="Random"
          value={settings.seed || ""}
          onChange={(e) => {
            const val = e.target.value;
            onChange({ ...settings, seed: val ? parseInt(val) : undefined });
          }}
          className="w-28 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
        />
      </div>

      {/* Model */}
      <div className="flex items-center gap-2">
        <label className="text-zinc-500 dark:text-zinc-400">Model:</label>
        <input
          type="text"
          value={settings.model}
          onChange={(e) => onChange({ ...settings, model: e.target.value })}
          placeholder="flux"
          className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
        />
      </div>
    </div>
  );
}
