"use client";

const TEMPLATES = [
  { value: "", label: "Select a template..." },
  { value: "portrait", label: "Portrait photography", prompt: "Professional portrait photography, soft natural lighting, shallow depth of field, high quality, detailed facial features, artistic composition" },
  { value: "product", label: "Product photography", prompt: "Professional product photography, clean studio background, soft box lighting, sharp focus, commercial quality, minimal shadows" },
  { value: "fantasy", label: "Fantasy landscape", prompt: "Epic fantasy landscape, magical atmosphere, dramatic sky, enchanted forest, mystical lighting, highly detailed, cinematic view" },
  { value: "logo", label: "Logo design", prompt: "Modern minimalist logo design, clean vector style, professional branding, scalable icon, simple geometric shapes, timeless design" },
  { value: "character", label: "Game character", prompt: "Detailed game character design, full body concept art, unique costume design, dynamic pose, ready for 3D modeling, professional game art" },
  { value: "cinematic", label: "Cinematic scene", prompt: "Cinematic movie scene, dramatic lighting, film grain, wide angle composition, atmospheric mood, Hollywood production quality, color graded" },
];

interface PromptTemplatesProps {
  onSelect: (prompt: string) => void;
  value?: string;
}

export function PromptTemplates({ onSelect, value }: PromptTemplatesProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="text-zinc-500 dark:text-zinc-400">Template:</label>
      <select
        value={value || ""}
        onChange={(e) => {
          const selected = TEMPLATES.find((t) => t.value === e.target.value);
          if (selected?.prompt) {
            onSelect(selected.prompt);
          }
        }}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-500"
      >
        {TEMPLATES.map((template) => (
          <option key={template.value} value={template.value}>
            {template.label}
          </option>
        ))}
      </select>
    </div>
  );
}
