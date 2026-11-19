"use client";

import { useEffect, useRef, useState } from "react";
import { AppImage } from "@/components/ui/app-image";
import { cn } from "@/lib/utils";

export type BrandLogo = { name: string; src: string };

function MarqueeItem({ logo, duplicate = false }: { logo: BrandLogo; duplicate?: boolean }) {
  return (
    <li
      data-marquee-item=""
      aria-hidden={duplicate || undefined}
      className="relative h-[42px] w-[126px] mr-2 shrink-0 overflow-clip iphone:mr-3.5"
    >
      <AppImage
        src={logo.src}
        alt={duplicate ? "" : logo.name}
        width={126}
        height={42}
        className="size-full object-contain"
        aria-hidden={duplicate}
      />
    </li>
  );
}

/**
 * Dua halves identik (A + A) ditranslas -50% oleh `animate-trusted-marquee`.
 * Jumlah salinan per half dihitung dari lebar viewport supaya tiap half selalu
 * lebih lebar dari wadah — loop tetap mulus berapapun jumlah logo.
 */
export function BrandMarquee({
  logos,
  className,
}: {
  logos: readonly BrandLogo[];
  className?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [copiesPerHalf, setCopiesPerHalf] = useState(3);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || logos.length === 0) return;

    const measure = () => {
      const first = viewport.querySelector<HTMLElement>("[data-marquee-item]");
      if (!first) return;
      const margin = parseFloat(getComputedStyle(first).marginRight || "0");
      const step = first.getBoundingClientRect().width + (Number.isFinite(margin) ? margin : 0);
      if (!Number.isFinite(step) || step <= 0) return;
      const needed = Math.ceil(viewport.clientWidth / step) + 1;
      setCopiesPerHalf((prev) => (prev === needed ? prev : needed));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [logos.length]);

  const half = Array.from({ length: copiesPerHalf }, (_, copy) =>
    logos.map((logo) => ({ logo, key: `${logo.name}-${copy}` })),
  ).flat();

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-label="Trusted brands"
      className={cn(
        "relative w-full overflow-hidden mask-[linear-gradient(to_right,transparent,black_12%,black_88%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]",
        className,
      )}
    >
      <ul className="flex w-max animate-trusted-marquee items-center will-change-transform motion-reduce:animate-none">
        {half.map(({ logo, key }) => (
          <MarqueeItem key={key} logo={logo} />
        ))}
        {half.map(({ logo, key }) => (
          <MarqueeItem key={`${key}-duplicate`} logo={logo} duplicate />
        ))}
      </ul>
    </div>
  );
}

export default BrandMarquee;
