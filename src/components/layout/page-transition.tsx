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
 * dengan animasi. Kecuali pilih tenant: klik memicu transisi IN (tahan),
 * render tujuan memicu transisi OUT (reveal).
 */
export function PageTransition() {
  const { resolvedTheme } = useTheme();
  const [trigger, setTrigger] = useState(0);
  const [hold, setHold] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    const shouldReveal = sessionStorage.getItem(TENANT_REVEAL_KEY) === "1";
    if (shouldReveal) sessionStorage.removeItem(TENANT_REVEAL_KEY);
    const id = setTimeout(() => {
      setMounted(true);
      if (shouldReveal) setReveal(true);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const play = () => {
      setHold(false);
      setTrigger((value) => value + 1);
    };
    const playHold = () => {
      setHold(true);
      setTrigger((value) => value + 1);
    };
    window.addEventListener("cervise:transition", play);
    window.addEventListener("cervise:transition-hold", playHold);
    return () => {
      window.removeEventListener("cervise:transition", play);
      window.removeEventListener("cervise:transition-hold", playHold);
    };
  }, []);

  if (!mounted) return null;
  const color = resolvedTheme === "dark" ? "#f5f5f5" : "#000000";
  if (reveal) {
    return <CascadePageTransition trigger={0} initialCovered colors={[color]} />;
  }
  return <CascadePageTransition trigger={trigger} holdAtCovered={hold} colors={[color]} />;
}

/** Putar transisi penuh (IN lalu OUT) setelah data berubah. */
export function playPageTransition() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("cervise:transition"));
}

/** Transisi IN dan tahan; OUT diputar saat halaman tujuan selesai render. */
export function beginTenantTransition() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TENANT_REVEAL_KEY, "1");
  window.dispatchEvent(new Event("cervise:transition-hold"));
}
