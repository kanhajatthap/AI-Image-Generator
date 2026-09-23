"use client";

import Image from "next/image";
import { useState } from "react";

const PLACEHOLDER_SVG =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="100%" height="100%" fill="#e4e4e7"/></svg>`,
  );

export function BlurImage({
  src,
  alt,
  width = 1024,
  height = 1024,
  className = "",
  eager = false,
  onLoad,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  eager?: boolean;
  onLoad?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative overflow-hidden bg-zinc-100 dark:bg-zinc-900">
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-100 via-zinc-200/60 to-zinc-100 dark:from-zinc-900 dark:via-zinc-800/60 dark:to-zinc-900" />
      )}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        loading={eager ? "eager" : "lazy"}
        placeholder="blur"
        blurDataURL={PLACEHOLDER_SVG}
        onLoad={() => {
          setLoaded(true);
          onLoad?.();
        }}
        className={`${className} ${loaded ? "blur-in-photo" : "opacity-0"}`}
      />
    </div>
  );
}