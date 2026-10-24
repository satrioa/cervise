"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";
import {
  CANDY_CARD,
  CANDY_CARD_COLOR,
  candyCardColorClass,
  type CandyCardColor,
} from "@/components/smoothui/smooth-button";

/**
 * Bento card untuk dashboard.
 *
 * Bentuknya mengikuti konsep Figma: grid 4 kolom x 3 baris, kartu
 * `rounded-2xl`.
 *
 * Dua jenis kartu:
 *
 * - **netral** (default): semua kartu data memakai satu abu-abu yang sama.
 * - **candy**: kartu aksi - "Servis baru", "Catat Kas", "Penjualan" - memakai
 *   permukaan candy SmoothUI. Gradien, border hairline, dan ring diambil
 *   langsung dari varian `candy` miliknya, jadi tidak ada duplikasi kelas.
 *
 * `candy` ada di props, bukan `action` yang menunjuk palet warna sendiri:
 * warnanya milik SmoothUI, jadi kartu ini tidak punya daftar warna kedua.
 */
export type { CandyCardColor };
export { CANDY_CARD_COLOR };

/**
 * Abu-abu netral untuk semua kartu data.
 *
 * Warna dan radius mengikuti frame Figma: permukaan abu-abu hangat di atas
 * halaman yang sedikit lebih terang, sudut 22px, dan padding lega. Hover cuma
 * naik satu tingkat - kartu tidak diangkat dengan bayangan.
 *
 * Kartu candy tidak memakai ini - permukaannya sudah berwarna, dan hover-nya
 * datang dari gradien candy.
 */
const NEUTRAL =
  "bg-[#E7E7E7] text-neutral-900 hover:bg-[#ECECEC] " +
  "dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800";

/**
 * Permukaan putih untuk kartu daftar/checklist.
 *
 * Di Figma kartu daftar sengaja putih agar terbaca sebagai lembar kerja di
 * atas kanvas abu-abu. Di dark mode putih dipetakan ke neutral-800 supaya
 * masih satu tingkat lebih terang dari kartu netral.
 */
const WHITE =
  "bg-white text-neutral-900 hover:bg-white " +
  "dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-800";

const PLAIN = "bg-transparent text-inherit";

/**
 * Easing yang dipakai hero, stepper, dan kartu ini -- semuanya
 * cubic-bezier(0.215, 0.61, 0.355, 1). Satu kurva untuk seluruh gerakan di
 * aplikasi, supaya tidak terasa seperti gerakan yang datang dari paket
 * berbeda.
 */
const BENTO_EASE = [0.215, 0.61, 0.355, 1] as const;

/**
 * Kelas grid bento, dipakai kedua dashboard.
 *
 * Di mobile grid dua kolom mengikuti frame Figma; di desktop empat kolom
 * dengan tinggi baris tetap 10.5rem. Tinggi baris tidak lagi membagi tinggi
 * viewport: kartu mengikuti tinggi isinya, dan halaman boleh menggulir.
 * Baris tetap (bukan `1fr`) membuat kartu yang `rowSpan` dua baris punya
 * proporsi yang sama di semua layar.
 */
export const BENTO_GRID_CLASS =
  "mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:auto-rows-[10.5rem] sm:gap-4";

/**
 * Jarak naik kartu, dalam px.
 *
 * 12px, bukan 20px. Grid dashboard rapat -- kartu yang bergeser 20px terlihat
 * menabrak tetangganya saat masih setengah jalan.
 */
const BENTO_RISE_PX = 12;

/**
 * Keyframes kartu bento. Satu sumber untuk `BentoCard` dan grid pembungkus.
 *
 * Delay TIDAK dihitung di sini: kartu menerimanya dari `staggerChildren` di
 * grid. Kalau tiap kartu menghitung delay dari nomor urut sendiri, setiap
 * pemanggilan site harus ingat mengoper indeks, dan satu yang terlupa akan
 * muncul tanpa animasi.
 */
/**
 * Keyframes kartu bento.
 *
 * SANGAT PENTING: kartu hanya memasang `variants`, tanpa `initial` dan
 * tanpa `animate`.
 *
 * Alasannya ada di `isControllingVariants()` (motion-dom): sebuah node
 * dianggap "meng kendalikan variantsnya sendiri" begitu salah satu dari
 * `initial` / `animate` berisi variant label. Node seperti itu TIDAK mewarisi
 * context dari induknya -- dan `staggerChildren` hanya bekerja lewat pewarisan
 * itu. Kalau kartu memasang `initial="hidden" animate="show"`, tiap kartu
 * menjadi akar animasinya sendiri, seluruhnya berjalan bersamaan, dan
 * stagger sama sekali tidak terjadi.
 *
 * Delay tidak dihitung di sini juga: kartu menerimanya dari `staggerChildren`
 * di grid. Kalau tiap kartu menghitung delay dari nomor urut, setiap
 * pemanggilan site harus ingat mengoper indeks, dan satu yang terlupa akan
 * muncul tanpa animasi.
 */
export const bentoCardVariants: Variants = {
  hidden: { opacity: 0, y: BENTO_RISE_PX },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: BENTO_EASE },
  },
};

/**
 * Keyframes grid pembungkus.
 *
 * `staggerChildren` di sini yang mengatur jarak antar kartu. Nilai 0.05 untuk
 * 6 kartu, 0.045 untuk 8 -- 8 x 70ms = 560ms terasa lambat di grid yang
 * sudah penuh.
 */
export const bentoGridVariants =
  (stagger: number): Variants => ({
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: 0.04 } },
  });

/**
 * Prop motion untuk grid pembungkus dan kartunya.
 *
 * Dipecah dalam satu hook supaya aturan reduce-motion punya satu tempat,
 * bukan diulang di setiap file dashboard.
 *
 * Grid memasang `initial`/`animate`; kartu tidak. Hanya grid yang boleh
 * mengendalikan variants -- kartu harus bebas agar mewarisi `staggerChildren`
 * dari grid.
 *
 * Saat reduce-motion aktif, keduanya dipasang kosong, bukan `initial={false}`.
 * Di sini lebih aman membiarkan kartu tanpa variants sama sekali, sehingga
 * tidak mungkin terkunci di `opacity: 0`.
 */
export function useBentoStagger(stagger: number) {
  // `=== true`, bukan `!prefersReducedMotion`: hasil hook berupa
  // `boolean | null` sebelum selesai di sisi klien, dan `null` harus
  // diperlakukan sebagai "boleh beranimasi" supaya kartu tidak terkunci diam
  // di render pertama.
  const reduceMotion = useReducedMotion() === true;

  const gridProps = reduceMotion
    ? {}
    : {
        variants: bentoGridVariants(stagger),
        initial: "hidden" as const,
        animate: "show" as const,
      };

  const cardProps = reduceMotion ? {} : { variants: bentoCardVariants };

  return { gridProps, cardProps, reduceMotion };
}

export type BentoCardProps = {
  children: React.ReactNode;
  /** Lebar bento di grid 4 kolom. */
  span?: 1 | 2 | 3 | 4;
  /**
   * Tinggi bento dalam baris grid.
   *
   * 2 dipakai kartu task di dashboard teknisi, 3 dipakai "Ringkasan Hari
   * ini" di dashboard frontliner yang membentang dari baris pertama sampai
   * baris terakhir.
   */
  rowSpan?: 1 | 2 | 3;
  /** Permukaan candy SmoothUI. Kosongkan untuk kartu data netral. */
  candy?: CandyCardColor;
  /**
   * Permukaan non-candy. `white` dipakai kartu daftar/checklist, `plain`
   * untuk sel yang isinya mengatur permukaannya sendiri (To-Do bento).
   */
  surface?: "neutral" | "white" | "plain";
  /**
   * Kartu ini ikut tinggi isinya, bukan meregang sampai tinggi sel grid.
   * Dipakai kartu yang daftarnya pendek, dan meregang hanya membuatnya
   * terlihat setengah kosong.
   */
  hug?: boolean;
  className?: string;
  onClick?: () => void;
  href?: string;
  title?: string;
};

const SPAN_CLASS: Record<NonNullable<BentoCardProps["span"]>, string> = {
  1: "",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
};

const ROW_SPAN_CLASS: Record<NonNullable<BentoCardProps["rowSpan"]>, string> = {
  1: "",
  2: "sm:row-span-2",
  3: "sm:row-span-3",
};

/*
 * Tinggi bento TIDAK ditulis dalam piksel.
 *
 * Sebelumnya `h-full` bikin sel tertinggi meregangkan barisnya, jadi isi satu
 * kartu ikut mengubah ukuran kartu lain. Lalu dicoba tinggi tetap dalam
 * piksel - tapi itu bocor saat layar pendek, karena gridnya `100dvh` dan
 * tinggi piksel tidak ikut menyusut, sehingga halaman kembali bisa di-scroll.
 *
  * Sekarang tinggi ditentukan grid: baris membagi tinggi yang tersedia
  * (`sm:grid-rows-3` di dalam wadah `flex-1 min-h-0`), dan kartu memakai
  * `h-full` untuk mengisi selnya. Hasilnya ukuran kartu tetap sama apakah
  * isinya kosong atau penuh, dan tetap ikut menyusut kalau layar pendek.
  */

/**
 * Sel bento. Kalau `href` diisi, dirender jadi Link supaya navigasi di sisi
 * klien; kalau `onClick` diisi, jadi button. `href` menang kalau keduanya ada.
 */
export function BentoCard({
  children,
  span = 1,
  rowSpan = 1,
  candy,
  surface = "neutral",
  hug = false,
  className,
  onClick,
  href,
  title,
}: BentoCardProps) {
  const { cardProps } = useBentoStagger(0);

  const classes = cn(
    // `h-full` + `min-h-0`: mengisi sel grid, dan boleh menyusut kalau
    // isinya sendiri yang butuh scroll, bukan kartunya. `hug` membalik ini -
    // kartu ikut tinggi isinya dan tidak meregang sampai tinggi sel.
    "group/bento relative flex min-h-0 w-full flex-col overflow-hidden rounded-[22px] p-4 sm:p-5",
    hug ? "h-fit" : "h-full",
    // Hover netral sengaja datar: kartu hanya sedikit lebih terang. Versi
    // lama mengangkat kartu dengan `hover:shadow-lg` + bayangan 28px, dan
    // itu terasa "terlalu tebal dan besar". Kartu candy punya hover-nya
    // sendiri dari gradien SmoothUI.
    "transition-colors duration-200",
    candy ? CANDY_CARD : surface === "white" ? WHITE : surface === "plain" ? PLAIN : NEUTRAL,
    candy && candyCardColorClass(candy),
    // `rounded-[22px]` di kartu mengalahkan `rounded-md` bawaan candy.
    candy && "rounded-[22px]",
    SPAN_CLASS[span],
    ROW_SPAN_CLASS[rowSpan],
    hug && "self-start",
    surface === "plain" && "p-0",
    href || onClick ? "cursor-pointer" : "",
    className,
  );

  // Kartu TIDAK memasang initial/animate -- lihat catatan di
  // `bentoCardVariants`. Menyematkannya di sini akan mematikan stagger.
  const animation = cardProps;

  if (href) {
    return (
      <motion.div {...animation} className="h-full min-h-0 w-full">
        <Link href={href} className={classes} title={title}>
          {children}
        </Link>
      </motion.div>
    );
  }
  if (onClick) {
    return (
      <motion.div {...animation} className="h-full min-h-0 w-full">
        <button type="button" onClick={onClick} className={classes} title={title}>
          {children}
        </button>
      </motion.div>
    );
  }
  return (
    <motion.div {...animation} className={classes}>
      {children}
    </motion.div>
  );
}

/**
 * Isi kartu candy: ikon + label, rata tengah.
 *
 * Kartu aksinya adalah permukaannya sendiri, jadi ini hanya kontennya. Versi
 * candy tidak menambahkan tombol di dalam - kalau tidak, kartu jadi dua
 * permukaan yang saling bersaing.
 */
export function BentoMenuItem({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="flex flex-1 flex-col items-start justify-between gap-3">
      <Icon className="size-7 drop-shadow-sm" />
      <span className="text-[15px] font-medium leading-tight">{label}</span>
    </span>
  );
}
