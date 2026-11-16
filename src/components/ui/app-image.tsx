"use client";

import DitherImage from "@/components/ui/smoothui/dither-image";
import { useStyleWorld } from "@/lib/style-world-context";
import { cn } from "@/lib/utils";
import Image, { type ImageProps } from "next/image";
import * as React from "react";

const SCIFI_PALETTE = ["#061108", "#4fdc68"];

type ImgProps = React.ImgHTMLAttributes<HTMLImageElement>;

export type AppImageProps = (ImageProps | (ImgProps & { fill?: never })) & {
  /** Keep image crisp (no dither) even in scifi world, e.g. QR/barcodes. */
  crisp?: boolean;
  /** Product images use a progressive scifi dither preset. */
  preset?: "product";
};

export function isScifiDitherActive(world: string, crisp?: boolean) {
  return world === "scifi" && !crisp;
}

function useElementSize<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function NormalImage(props: any) {
  const { crisp: _crisp, preset: _preset, ...rest } = props;
  const { src, fill } = rest;

  // Prefer next/image for normal rendering to preserve existing behavior.
  const canUseNext =
    fill ||
    rest.width !== undefined ||
    rest.height !== undefined ||
    rest.priority !== undefined ||
    rest.sizes !== undefined ||
    rest.quality !== undefined ||
    rest.placeholder !== undefined ||
    rest.blurDataURL !== undefined ||
    rest.loader !== undefined ||
    (src && typeof src === "object");

  if (canUseNext) {
    return <Image {...(rest as ImageProps)} alt={rest.alt ?? ""} />;
  }

  const { alt, width, height, className, style, ...imgRest } = rest as ImgProps & { src?: any };
  const resolvedSrc = typeof src === "string" ? src : (src?.src ?? src ?? "");
  return (
    <img
      {...imgRest}
      src={resolvedSrc}
      alt={alt ?? ""}
      width={width}
      height={height}
      className={className}
      style={style}
    />
  );
}

export function AppImage(props: AppImageProps) {
  const { world } = useStyleWorld();
  const anyProps = props as any;
  const { crisp, preset, fill, src, alt, className, style, width, height } = anyProps;
  const isProduct = preset === "product";
  const ditherLevels = 2;
  const ditherPixelSize = isProduct ? 4 : 2;
  const progressive = isProduct;
  const pixelShape = isProduct ? "plus" : "square";

  if (!isScifiDitherActive(world, crisp)) {
    return <NormalImage {...anyProps} />;
  }

  const resolvedSrc: string =
    typeof src === "string" ? src : (src?.src ?? src ?? "");

  const explicitW = toNumber(width);
  const explicitH = toNumber(height);

  if (explicitW && explicitH && !fill) {
    return (
      <DitherImage
        src={resolvedSrc}
        alt={alt ?? ""}
        width={Math.round(explicitW)}
        height={Math.round(explicitH)}
        algorithm="threshold"
        levels={ditherLevels}
        pixelSize={ditherPixelSize}
        pixelShape={pixelShape}
        progressive={progressive}
        palette={SCIFI_PALETTE}
        className={cn(className)}
      />
    );
  }

  // fill or unknown size: measure container
  return (
    <FillDither
      src={resolvedSrc}
      alt={alt ?? ""}
      className={className}
      style={style}
      levels={ditherLevels}
      pixelSize={ditherPixelSize}
      pixelShape={pixelShape}
      progressive={progressive}
    />
  );
}

function FillDither({
  src,
  alt,
  className,
  style,
  levels,
  pixelSize,
  pixelShape,
  progressive,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  levels: number;
  pixelSize: number;
  pixelShape: "square" | "plus";
  progressive: boolean;
}) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  return (
    <div ref={ref} className={cn("relative h-full w-full", className)} style={style}>
      {size ? (
        <DitherImage
          src={src}
          alt={alt}
          width={size.width}
          height={size.height}
          algorithm="threshold"
          levels={levels}
          pixelSize={pixelSize}
          pixelShape={pixelShape}
          progressive={progressive}
          palette={SCIFI_PALETTE}
          className="h-full w-full rounded-[inherit]"
        />
      ) : (
        <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      )}
    </div>
  );
}

export default AppImage;
