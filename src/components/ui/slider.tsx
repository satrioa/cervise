"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "@/lib/utils";

/**
 * Slider volume ala bar isian: track tebal, indikator berwarna, thumb tipis.
 *
 * `children` dirender setelah `Control`, dipakai untuk angka volume yang
 * diletakkan di tengah bar (posisi diatur pemanggil). Struktur Root > Control >
 * Track > (Indicator, Thumb) mengikuti contoh resmi Base UI; `Thumb` menghitung
 * inset-nya relatif ke `Control`, jadi ia harus tetap di dalam `Track`.
 */
export function Slider({
  className,
  children,
  thumbLabel = "Volume",
  ...props
}: SliderPrimitive.Root.Props<number> & { thumbLabel?: string }): React.ReactElement {
  return (
    <SliderPrimitive.Root className={cn("relative w-full select-none", className)} {...props}>
      <SliderPrimitive.Control className="flex w-full touch-none items-center">
        <SliderPrimitive.Track className="relative h-7 w-full overflow-hidden rounded-lg bg-black/[0.07] dark:bg-white/10">
          <SliderPrimitive.Indicator className="h-full rounded-lg bg-[#2F80ED]" />
          <SliderPrimitive.Thumb
            aria-label={thumbLabel}
            className="block h-5 w-1.5 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.35)] outline-none focus-visible:ring-2 focus-visible:ring-[#2F80ED] data-disabled:opacity-50"
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
      {children}
    </SliderPrimitive.Root>
  );
}
