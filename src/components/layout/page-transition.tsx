"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import CascadePageTransition from "@/components/ui/CascadePageTransition";

const TENANT_REVEAL_KEY = "cervise:tenant-reveal";

/**
 * Cascade setelah data berubah (mutasi, `router.refresh()`, reload daftar).
 * Navigasi halaman sengaja tidak memicunya; pemanggil mengirim event lewat
 * `playPageTransition()`.
 *
 * Mount pertama sengaja dilewati supaya refresh browser tidak menutup layar
 * dengan animasi. Kecuali saat memilih tenant: klik memicu transisi masuk,
 * lalu render tujuan memicu transisi keluar (reveal).
 */
export function PageTransition() {
  const { resolvedTheme } = useTheme();
  const [trigger, setTrigger] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setMounted(true);
      if (sessionStorage.getItem(TENANT_REVEAL_KEY) === "1") {
        sessionStorage.removeItem(TENANT_REVEAL_KEY);
        window.dispatchEvent(new Event("cervise:transition"));
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const play = () => setTrigger((value) => value + 1);
    window.addEventListener("cervise:transition", play);
    return () => window.removeEventListener("cervise:transition", play);
  }, []);

  if (!mounted) return null;
  const color = resolvedTheme === "dark" ? "#f5f5f5" : "#000000";
  return <CascadePageTransition trigger={trigger} colors={[color]} />;
}

/** Putar transisi setelah data berubah (mutasi, `router.refresh()`). */
export function playPageTransition() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("cervise:transition"));
}

/** Tandai transisi masuk saat pilih tenant; reveal diputar saat tujuan selesai render. */
export function beginTenantTransition() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TENANT_REVEAL_KEY, "1");
  playPageTransition();
}
