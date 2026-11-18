"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/**
 * Smooth scroll HANYA untuk landing page. Komponen ini sengaja tidak dipasang
 * di root layout / shell aplikasi supaya halaman bertolak seperti `/app`
 * memakai scroll native bawaan browser.
 */
export function LandingSmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: true,
      // Nav landing memakai tautan #fitur / #harga / #faq — tanpa ini Lenis
      // memblokir anchor link (lihat dokumentasi Lenis).
      anchors: true,
      smoothWheel: true,
      // Touch native dipertahankan: syncTouch bisa tidak stabil di iOS lama.
      syncTouch: false,
      respectReducedMotion: true,
    });

    return () => lenis.destroy();
  }, []);

  return null;
}
