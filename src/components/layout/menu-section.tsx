"use client";

import { useId, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Minus, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Section collapsible drawer menu.
 *
 * Tinggi dianimasikan `auto <-> 0` dengan spring; isinya bergerak masuk dari
 * kiri (x: -12 -> 0) supaya arah buka-tertutup terbaca sebagai satu gerakan,
 * bukan dua animasi terpisah.
 *
 * Ikon kanan adalah satu-satunya penanda state: `+` saat tertutup, `-` saat
 * terbuka. Itu toggle section ini, bukan tombol tutup drawer — drawer ditutup
 * lewat Esc atau tap backdrop.
 */
export type MenuSectionProps = {
  icon: LucideIcon;
  label: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
};

const HEIGHT_SPRING = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 } as const;
const CONTENT_SPRING = { type: "spring", stiffness: 380, damping: 34 } as const;
const INSTANT = { duration: 0 } as const;

export function MenuSection({
  icon: Icon,
  label,
  defaultOpen = false,
  className,
  children,
}: MenuSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  /**
   * Konten baru dipasang setelah section pertama kali dibuka.
   *
   * Analytic Servis memanggil server action; kalau isinya langsung ter-mount,
   * setiap kali drawer dibuka ikut memicu satu round-trip walau section-nya
   * tidak pernah dilihat. Efek sampingnya: animasi buka pertama tetap benar,
   * karena konten sudah ada di render yang sama dengan perubahan `open`.
   */
  const [mounted, setMounted] = useState(defaultOpen);
  const regionId = useId();
  const reduceMotion = useReducedMotion();

  const toggle = () => {
    setOpen((previous) => {
      if (!previous) setMounted(true);
      return !previous;
    });
  };

  return (
    <section className={cn(className)}>
      <h2 className="border-b border-black/10 dark:border-white/10">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={regionId}
          className="flex w-full items-center gap-3 py-3.5 text-left"
        >
          <Icon className="size-[18px] shrink-0 text-neutral-500 dark:text-neutral-400" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-700 dark:text-neutral-200">
            {label}
          </span>
          <span aria-hidden className="flex size-6 shrink-0 items-center justify-center text-neutral-400 dark:text-neutral-500">
            {open ? <Minus className="size-4" /> : <Plus className="size-4" />}
          </span>
        </button>
      </h2>

      <motion.div
        id={regionId}
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={reduceMotion ? INSTANT : HEIGHT_SPRING}
        className="overflow-hidden"
        // `inert` menahan Tab masuk ke isi yang tingginya 0 tapi masih ada di DOM.
        inert={!open}
      >
        {mounted ? (
          <motion.div
            initial={false}
            animate={{ x: open || reduceMotion ? 0 : -12 }}
            transition={reduceMotion ? INSTANT : CONTENT_SPRING}
            className="pb-4 pt-3"
          >
            {children}
          </motion.div>
        ) : null}
      </motion.div>
    </section>
  );
}
