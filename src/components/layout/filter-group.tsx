"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { SlidersHorizontalIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BP = {
  sm: {
    trigger: "sm:hidden",
    summary: "sm:hidden",
    child: "[&>*]:max-sm:w-full",
    panel: "sm:order-2 sm:flex sm:w-auto sm:flex-nowrap sm:items-center sm:gap-2",
  },
  lg: {
    trigger: "lg:hidden",
    summary: "lg:hidden",
    child: "[&>*]:max-lg:w-full",
    panel: "lg:order-2 lg:flex lg:w-auto lg:flex-nowrap lg:items-center lg:gap-2",
  },
} as const;

/**
 * Baris filter yang bisa dilipat di mobile.
 *
 * Di bawah breakpoint `breakpoint` kontrol disembunyikan di balik tombol ikon
 * dan dibuka sebagai grid 2 kolom; di atasnya kontrol dirender inline seperti
 * biasa. Ringkasan filter aktif ikut tampil saat panel tertutup supaya
 * pengguna tahu daftar sedang dipersempit dan bisa menghapusnya.
 */
export function FilterGroup({
  children,
  count = 0,
  summary,
  clearHref,
  onClear,
  breakpoint = "sm",
  className,
}: {
  children: React.ReactNode;
  count?: number;
  summary?: string;
  clearHref?: string;
  onClear?: () => void;
  breakpoint?: keyof typeof BP;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const bp = BP[breakpoint];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={count > 0 ? `Filter (${count} aktif)` : "Filter"}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className={cn("relative order-2 shrink-0", bp.trigger)}
      >
        <SlidersHorizontalIcon className="size-4" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium leading-none text-primary-foreground">
            {count}
          </span>
        ) : null}
      </Button>

      {count > 0 ? (
        <div className={cn("order-4 flex w-full min-w-0 items-center gap-2", bp.summary)}>
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {summary ?? `${count} filter aktif`}
          </p>
          {clearHref || onClear ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="shrink-0 gap-1 px-1.5 text-muted-foreground"
              {...(clearHref
                ? { render: <Link href={clearHref} /> }
                : { onClick: onClear })}
            >
              <XIcon className="size-3" /> Hapus
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        id={id}
        className={cn(
          "order-5 w-full min-w-0 [&>*]:min-w-0",
          bp.child,
          open ? "grid grid-cols-2 items-center gap-2" : "hidden",
          bp.panel,
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
