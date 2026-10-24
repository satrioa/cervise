"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Sembunyikan chrome (header + bottom bar) setelah beberapa detik tanpa
 * aktivitas, dan munculkan lagi begitu ada gerakan.
 *
 * Kenapa timer disimpan di effect, bukan di event handler: `setState` di dalam
 * effect body dilarang `react-hooks/set-state-in-effect`, dan yang kita
 * butuhkan memang reaksi terhadap perubahan state lain (hover, suspensi,
 * aktivitas). Yang dipanggil di effect hanya `setTimeout`; `setIdle(true)`
 * terjadi di callback timer, bukan saat effect berjalan.
 *
 * `visible` diturunkan, bukan disimpan: selama kursor di atas chrome
 * (`hovered`) atau chrome ditahan (`suspended`, mis. drawer terbuka), nilainya
 * selalu true tanpa perlu membatalkan/mengatur ulang timer.
 */
export const CHROME_IDLE_MS = 5000;

/**
 * Jeda minimum antar-reset. `pointermove` bisa ratusan kali per detik; tanpa
 * ini setiap gerakan kecil membuat satu `setTimeout` baru.
 */
const ACTIVITY_THROTTLE_MS = 250;

const ACTIVITY_EVENTS = [
  "pointermove",
  "pointerdown",
  "wheel",
  "keydown",
  "touchstart",
  "scroll",
] as const;

export type IdleVisibility = {
  visible: boolean;
  /** Pasang di `onPointerEnter` chrome. */
  holdPointer: () => void;
  /** Pasang di `onPointerLeave` chrome. */
  releasePointer: () => void;
};

export type IdleVisibilityOptions = {
  /** Default 5 detik. */
  delay?: number;
  /** Selama benar, chrome tidak pernah disembunyikan (mis. drawer terbuka). */
  suspended?: boolean;
};

export function useIdleVisibility({
  delay = CHROME_IDLE_MS,
  suspended = false,
}: IdleVisibilityOptions = {}): IdleVisibility {
  const [idle, setIdle] = useState(false);
  const [hovered, setHovered] = useState(false);
  // Naikkan untuk memulai ulang jendela idle tanpa menyentuh `idle` saat
  // nilainya sudah false (setState dengan nilai yang sama tidak merender).
  const [activity, setActivity] = useState(0);

  useEffect(() => {
    if (suspended || hovered) return;
    const timer = setTimeout(() => setIdle(true), delay);
    return () => clearTimeout(timer);
  }, [delay, suspended, hovered, activity]);

  useEffect(() => {
    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - last < ACTIVITY_THROTTLE_MS) return;
      last = now;
      setIdle(false);
      setActivity((value) => value + 1);
    };

    // `capture` supaya scroll dari elemen di dalam `main` ikut terhitung:
    // event `scroll` tidak menggelembung ke window.
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true, capture: true });
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity, { capture: true });
      }
    };
  }, []);

  const holdPointer = useCallback(() => setHovered(true), []);
  const releasePointer = useCallback(() => setHovered(false), []);

  return { visible: !idle || suspended || hovered, holdPointer, releasePointer };
}
