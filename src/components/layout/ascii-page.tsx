"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AsciiReveal } from "@/components/ui/ascii";

/**
 * Pembungkus isi halaman untuk reveal Blueprint.
 *
 * `key={pathname}` membuat tiap navigasi me-mount ulang reveal, jadi konten
 * halaman baru selalu decode masuk — sementara header, sidebar, dan bottom bar
 * (di luar pembungkus ini) tidak ikut berkedip.
 *
 * `className` diteruskan ke wrapper: Compact shell memakai `h-full` supaya
 * rantai tinggi halaman (mis. POS yang mengisi sisa `main`) tetap utuh.
 */
export function AsciiPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <AsciiReveal key={pathname} preset="blueprint" className={className}>
      {children}
    </AsciiReveal>
  );
}
