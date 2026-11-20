"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

const LIGHT = "#ffffff";
const DARK = "#0a0a0a";

/**
 * Menyelaraskan meta theme-color dengan warna halaman yang benar-benar tampil.
 *
 * - Landing (`/`) memakai scope `.landing-light`, jadi tetap putih meskipun
 *   tema aplikasi sedang dark.
 * - Halaman lain mengikuti tema aktif (next-themes), termasuk saat user
 *   mengganti tema lewat toggle — media query di layout saja tidak cukup.
 *
 * Safari tab biasa tidak mengubah warna chrome browser; ini berlaku untuk
 * Chrome/Android dan web app yang dipasang ke home screen (PWA).
 */
export function ThemeColorSync() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const color = pathname === "/" || resolvedTheme !== "dark" ? LIGHT : DARK;
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    const meta = metas[0] ?? document.createElement("meta");

    if (!meta.isConnected) {
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    for (const extra of metas) {
      if (extra !== meta) extra.remove();
    }
    meta.removeAttribute("media");
    meta.content = color;
  }, [pathname, resolvedTheme]);

  return null;
}
