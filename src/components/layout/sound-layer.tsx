"use client";

import { useEffect } from "react";
import { playSound, sfx, type SoundName } from "@/lib/sound";

/**
 * SoundLayer — lapisan suara untuk interaksi yang TIDAK punya primitif sendiri.
 *
 * Kenapa perlu: sebagian besar UI Cervise memakai primitif (Button, Tabs,
 * Dialog, Menu, Select…), tetapi masih banyak elemen interaktif "telanjang":
 * tautan sidebar, item menu, opsi autocomplete, tombol ikon mentah, dsb.
 * Daripada menempelkan `onClick` di ratusan call site, satu listener global
 * mengenali jenis elemen dari semantik DOM (role/aria) lalu memutar suara yang
 * sesuai.
 *
 * Aturan:
 * - Satu klik = satu suara. Button menandai event-nya (`__cerviseSfx`) supaya
 *   lapisan ini tidak menambah suara kedua.
 * - Elemen dengan `data-sfx="<nama>"` memutar sound tersebut (escape hatch
 *   manual), `data-sfx-silent` mematikan suara untuk subtree-nya.
 * - Klik kanan, klik dengan teks terseleksi (drag select), dan kontrol
 *   disabled tidak bersuara.
 */
const INTERACTIVE_SELECTOR = [
  "[data-sfx]",
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="switch"]',
  "[aria-pressed]",
  "[aria-expanded]",
  "a[href]",
  "button",
].join(",");

const SELECTION_ROLES =
  '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"],[role="radio"]';

type SfxEvent = MouseEvent & { __cerviseSfx?: boolean };

function isDisabled(el: Element): boolean {
  if (el.hasAttribute("disabled")) return true;
  if (el.getAttribute("aria-disabled") === "true") return true;
  // Base UI memakai data-disabled pada beberapa kontrol.
  if (el.hasAttribute("data-disabled")) return true;
  return false;
}

/** Navigasi internal (bukan anchor di halaman yang sama, bukan tab baru). */
function isInternalNavigation(anchor: HTMLAnchorElement): boolean {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return false;
  try {
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    // Link ke halaman yang sama (hash/query saja) bukan "pindah halaman".
    if (url.pathname === window.location.pathname && url.search === window.location.search) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function SoundLayer() {
  useEffect(() => {
    const onClick = (event: SfxEvent) => {
      if (event.button !== 0) return;
      if (event.defaultPrevented) return;
      // Sudah bersuara dari primitif (Button).
      if (event.__cerviseSfx) return;
      // Jangan bersuara saat pengguna sedang menyeleksi teks.
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-sfx-silent]")) return;
      // Tombol primitif Cervise (Button) mengurus suaranya sendiri — jangan
      // ditambah suara generik.
      if (target.closest("[data-sfx-managed]")) return;

      const el = target.closest<HTMLElement>(INTERACTIVE_SELECTOR);
      if (!el || isDisabled(el)) return;

      const explicit = el.dataset.sfx;
      if (explicit) {
        playSound(explicit as SoundName);
        return;
      }

      if (el.matches(SELECTION_ROLES)) {
        sfx.select();
        return;
      }

      if (el.matches('[role="tab"]')) {
        sfx.tab();
        return;
      }

      if (el.matches('[role="checkbox"],[role="switch"],[aria-pressed]')) {
        // Nilai aria saat ini = keadaan SEBELUM klik. Toggle ON/OFF mengikuti
        // keadaan sesudahnya, supaya pasangan clasp/unclasp terdengar benar.
        const current = el.getAttribute("aria-checked") ?? el.getAttribute("aria-pressed");
        if (current === "true") sfx.toggleOff();
        else sfx.toggleOn();
        return;
      }

      if (el.matches("[aria-expanded]")) {
        // Disclosure/accordion: buka = expose, tutup = lepas.
        if (el.getAttribute("aria-expanded") === "true") sfx.toggleOff();
        else sfx.toggleOn();
        return;
      }

      if (el.tagName === "A") {
        if (isInternalNavigation(el as HTMLAnchorElement)) sfx.tab();
        return;
      }

      if (el.tagName === "BUTTON") {
        // Tombol mentah (bukan primitif Button): efek klik generik dew/boop.
        sfx.click();
      }
    };

    // Fase CAPTURE: listener ini harus jalan sebelum handler React milik
    // primitif (Menu/Select/Popover). Dengan begitu `playedRecently` sudah
    // terisi saat primitif memutuskan apakah perlu memutar suara buka — satu
    // klik tetap satu suara.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
