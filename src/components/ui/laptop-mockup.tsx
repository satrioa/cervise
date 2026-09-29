import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Bingkai laptop untuk hero landing page.
 *
 * `cn` berasal dari paket `cn` (v0.3.3) yang sudah menggabungkan clsx dan
 * tailwind-merge, jadi `clsx` dan `tailwind-merge` tidak perlu dipasang
 * terpisah. `src/lib/utils.ts` hanya meng-export ulang `cn` dari situ.
 *
 * Bingkai digambar dengan CSS, bukan SVG. Alasannya: isi layar harus bisa
 * diganti dari luar (children), dan pada SVG layar menyatu dengan bodi --
 * tidak ada elemen yang bisa menerima konten.
 */

const laptopFrameVariants = {
  gray: {
    border: "border-neutral-300",
    base: "bg-linear-to-b from-neutral-300 to-neutral-400",
    notch: "bg-neutral-500",
  },
  titanium: {
    border: "border-[#7a7671]",
    base: "bg-linear-to-b from-[#8a8580] to-[#6a6560]",
    notch: "bg-[#5c5854]",
  },
  white: {
    border: "border-neutral-200",
    base: "bg-linear-to-b from-neutral-100 to-neutral-300",
    notch: "bg-neutral-400",
  },
  purple: {
    border: "border-[#5a515f]",
    base: "bg-linear-to-b from-[#5a515f] to-[#403948]",
    notch: "bg-[#332d3a]",
  },
  orange: {
    border: "border-[#c97f52]",
    base: "bg-linear-to-b from-[#dc9268] to-[#c26f45]",
    notch: "bg-[#a85e39]",
  },
  cherry: {
    border: "border-[#c48a98]",
    base: "bg-linear-to-b from-[#daa8b5] to-[#c48a98]",
    notch: "bg-[#b57987]",
  },
  midnight: {
    border: "border-[#26262c]",
    base: "bg-linear-to-b from-[#34343c] to-[#1c1c22]",
    notch: "bg-[#131318]",
  },
  starlight: {
    border: "border-[#d8cdb8]",
    base: "bg-linear-to-b from-[#f0e6d4] to-[#dcd0b8]",
    notch: "bg-[#c9bc9e]",
  },
  skyBlue: {
    border: "border-[#a9c4d8]",
    base: "bg-linear-to-b from-[#c3dbe8] to-[#9fc0d4]",
    notch: "bg-[#87abc2]",
  },
  gold: {
    border: "border-[#c9a13b]",
    base: "bg-linear-to-b from-[#e8c563] to-[#d4a93f]",
    notch: "bg-[#b8902e]",
  },
} as const;

export type LaptopFrameVariant = keyof typeof laptopFrameVariants;

export const LAPTOP_FRAME_VARIANTS = Object.keys(
  laptopFrameVariants,
) as readonly LaptopFrameVariant[];

/**
 * Ukuran, bukan breakpoint Tailwind.
 *
 * Di hero, komponen ini duduk di dalam artboard yang ukurannya tetap lalu
 * diperkecil dengan `transform: scale()`. Kalau ukuran memakai `md:`, yang
 * bereaksi adalah lebar VIEWPORT, bukan lebar artboard -- jadi di artboard
 * 900px yang diskalakan ke layar 700px, `md:` tetap aktif dan laptop ikut
 * ikut memakai ukuran besar yang tidak proporsional dengan HP di sebelahnya.
 *
 * Pemanggil yang tahu lebar artboardnya memilih ukuran secara langsung.
 */
const laptopSizes = {
  sm: {
    shell: "w-70",
    screen: "h-46",
    base: "h-2.5 w-78.75",
    notch: "w-14",
  },
  md: {
    shell: "w-[384px]",
    screen: "h-63",
    base: "h-3 w-108",
    notch: "w-16",
  },
} as const;

export type LaptopMockupSize = keyof typeof laptopSizes;

type LaptopMockupCardProps = Readonly<
  ComponentPropsWithoutRef<"div"> & {
    variant?: LaptopFrameVariant;
    size?: LaptopMockupSize;
    children?: ReactNode;
  }
>;

/**
 * Bingkai laptop: layar di atas, basis laptop di bawah.
 *
 * Basis sedikit lebih lebar dari layar (w-108 vs w-384, w-78.75 vs w-70)
 * supaya tepinya mencuat dari kedua sisi dan terbaca sebagai laptop. Kalau
 * samanya, bentuknya jadi persegi rata dan tidak terbaca.
 */
export const LaptopMockupCard = forwardRef<HTMLDivElement, LaptopMockupCardProps>(
  ({ className, children, variant = "gray", size = "md", ...props }, ref) => {
    const frame = laptopFrameVariants[variant];
    const dims = laptopSizes[size];

    return (
      <div
        ref={ref}
        data-slot="laptop-mockup-card"
        data-variant={variant}
        data-size={size}
        className={cn("flex flex-col items-center font-sans", className)}
        {...props}
      >
        <div
          className={cn(
            "overflow-hidden rounded-t-xl border-2 border-b-0 shadow-xl",
            dims.shell,
            frame.border,
          )}
        >
          {/* Bezel gelap: jarak antara tepi luar dan layar. Tanpa ini layar
              menempel ke bodi dan mockup-nya terbaca sebagai kotak warna. */}
          <div className="bg-neutral-800 p-1.5 pb-0">
            <div
              className={cn(
                "relative overflow-hidden rounded-t-sm bg-neutral-900",
                dims.screen,
              )}
            >
              {children}
            </div>
          </div>
        </div>

        <div className={cn("relative rounded-b-xl", dims.base, frame.base)}>
          {/* Lekukan di tepi atas basis -- detail yang membuatnya terbaca
              sebagai laptop dan bukan sekadar persegi abu-abu. */}
          <div
            className={cn(
              "absolute top-0 left-1/2 h-1 -translate-x-1/2 rounded-b-md",
              dims.notch,
              frame.notch,
            )}
            aria-hidden="true"
          />
        </div>
      </div>
    );
  },
);

LaptopMockupCard.displayName = "LaptopMockupCard";
