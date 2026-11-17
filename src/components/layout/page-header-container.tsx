"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useShellChrome } from "./shell-chrome";

/**
 * Baris di dalam `PageHeader`.
 *
 * Shell compact (teknisi/frontliner) mengikuti lebar konten halaman seperti
 * sebelumnya, sedangkan master admin memakai seluruh lebar area konten dengan
 * padding kecil. `PageHeader` tetap server component — keputusan shell diambil
 * di sini lewat context.
 */
export function PageHeaderContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const compact = useShellChrome();
  return (
    <div
      className={cn(
        compact
          ? "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8"
          : "w-full px-3 sm:px-4 lg:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
