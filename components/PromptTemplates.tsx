"use client";

const TEMPLATES = [
  { id: "logo", label: "Logo Generator", prompt: "Create a modern minimalist logo for a tech company, clean design, vector style, professional branding" },
  { id: "avatar", label: "Avatar", prompt: "Create a professional portrait avatar, friendly expression, neutral background, high quality" },
  { id: "wallpaper", label: "Wallpaper", prompt: "Create a stunning landscape wallpaper, 4k resolution, dramatic lighting, nature scenery" },
  { id: "product", label: "Product Mockup", prompt: "Create a product mockup presentation, clean white background, professional lighting, marketing style" },
  { id: "youtube", label: "YouTube Thumbnail", prompt: "Create an eye-catching YouTube thumbnail, bold text overlay, vibrant colors, high contrast, clickbait style" },
];

interface PromptTemplatesProps {
  onSelect: (prompt: string) => void;
}

export function PromptTemplates({ onSelect }: PromptTemplatesProps) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {TEMPLATES.map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => onSelect(template.prompt)}
          className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
        >
          {template.label}
        </button>
      ))}
    </div>
  );
}
