"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const AUTOPLAY_MS = 5000;

/**
 * Slider banner halaman Lacak (maks 3 gambar, rasio 2:1).
 *
 * Memakai `scroll-snap` bawaan browser, jadi swipe di HP dan trackpad bekerja
 * tanpa library tambahan. Auto-play berhenti saat kursor/fokus masuk, tab
 * tersembunyi, atau pengunjung meminta animasi dikurangi.
 */
export function PublicBanner({ images }: { images: string[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (images.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      if (document.hidden) return;
      setIndex((prev) => (prev + 1) % images.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [images.length, paused]);

  useEffect(() => {
    const track = trackRef.current;
    if (track) track.scrollTo({ left: Math.min(index, Math.max(0, images.length - 1)) * track.clientWidth, behavior: "smooth" });
  }, [index, images.length]);

  return (
    <div
      className="relative isolate aspect-[2/1] w-full overflow-hidden bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary)_55%,var(--background)))]"
      aria-roledescription="carousel"
      aria-label="Banner toko"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {images.length === 0 ? null : (
        <div
          ref={trackRef}
          onScroll={(e) => {
            const track = e.currentTarget;
            if (track.clientWidth === 0) return;
            const next = Math.round(track.scrollLeft / track.clientWidth);
            if (next !== index) setIndex(next);
          }}
          className="flex size-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((src, i) => (
            <div
              key={src}
              role="group"
              aria-roledescription="slide"
              aria-label={`Banner ${i + 1} dari ${images.length}`}
              className="relative size-full shrink-0 snap-center"
            >
              <Image
                src={src}
                alt=""
                fill
                priority={i === 0}
                sizes="100vw"
                unoptimized
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {images.length > 1 ? (
        <div className="absolute inset-x-0 bottom-9 z-10 flex justify-center gap-1.5">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={`Tampilkan banner ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`size-2 rounded-full transition-colors ${
                i === index ? "bg-background" : "bg-background/50 hover:bg-background/75"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
