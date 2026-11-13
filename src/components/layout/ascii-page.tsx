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
 * `reveal={false}` melewati efek blueprint (dipakai saat transisi slide nav
 * utama agar animasi tidak saling bertabrakan).
 */
export function AsciiPage({
  children,
  className,
  reveal = true,
}: {
  children: ReactNode;
  className?: string;
  reveal?: boolean;
}) {
  const pathname = usePathname();

  if (!reveal) {
    return (
      <div key={pathname} className={className}>
        {children}
      </div>
    );
  }

  return (
    <AsciiReveal key={pathname} preset="blueprint" className={className}>
      {children}
    </AsciiReveal>
  );
}
