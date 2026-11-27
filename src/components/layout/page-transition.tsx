"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import CascadePageTransition from "@/components/ui/CascadePageTransition";

const TENANT_REVEAL_KEY = "kaggo:tenant-reveal";

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
    const timers: number[] = [];
    // Base UI memberi `body.style.pointerEvents = "none"` saat overlay/menu
    // modal terbuka dan mengembalikannya lewat cleanup effect. Kalau overlay
    // unmount di tengah transisi, cleanup bisa terlewat: halaman tampak normal
    // tapi semua klik mati sampai di-refresh. Transisi adalah titik di mana
    // kita menjamin dokumen kembali interaktif.
    const release = () => {
      if (document.body.style.pointerEvents === "none") {
        document.body.style.pointerEvents = "";
      }
    };
    const scheduleRelease = () => {
      release();
      // Overlay juga bisa menaruh pointer-events saat animasi cascade berjalan,
      // jadi ulangi setelah transisi selesai (~1,7s) dengan margin.
      timers.push(window.setTimeout(release, 2200));
    };
    const play = () => {
      scheduleRelease();
      setHold(false);
      setTrigger((value) => value + 1);
    };
    const playHold = () => {
      scheduleRelease();
      setHold(true);
      setTrigger((value) => value + 1);
    };
    window.addEventListener("kaggo:transition", play);
    window.addEventListener("kaggo:transition-hold", playHold);
    return () => {
      window.removeEventListener("kaggo:transition", play);
      window.removeEventListener("kaggo:transition-hold", playHold);
      timers.forEach((id) => window.clearTimeout(id));
      release();
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
  window.dispatchEvent(new Event("kaggo:transition"));
}

/** Transisi IN dan tahan; OUT diputar saat halaman tujuan selesai render. */
export function beginTenantTransition() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TENANT_REVEAL_KEY, "1");
  window.dispatchEvent(new Event("kaggo:transition-hold"));
}
