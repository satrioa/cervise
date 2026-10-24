"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_SOUND,
  getSoundSnapshot,
  playCue,
  subscribeSoundStore,
  writeSoundSettings,
  type SoundSettings,
} from "@/lib/sound";
import { cn } from "@/lib/utils";

/**
 * Isi section "Sound System": mute dan volume untuk nada UI aplikasi.
 *
 * Bunyinya disintesis `playCue()` (Web Audio), jadi tidak ada file audio yang
 * perlu diunduh. Preferensi disimpan di localStorage lewat store di
 * `@/lib/sound`, jadi tab lain ikut berubah tanpa reload.
 *
 * `useSyncExternalStore`, bukan `useState` + `useEffect`: localStorage adalah
 * sumber di luar React, dan membaca snapshot di effect akan memicu render
 * berantai (dilarang `react-hooks/set-state-in-effect`).
 */
export function MenuSound() {
  const t = useTranslations("nav.menu");
  const settings = useSyncExternalStore(subscribeSoundStore, getSoundSnapshot, () => DEFAULT_SOUND);

  const apply = (patch: Partial<SoundSettings>) => {
    writeSoundSettings({ ...getSoundSnapshot(), ...patch });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex rounded-full bg-black/[0.06] p-0.5 dark:bg-white/10">
        <button
          type="button"
          onClick={() => apply({ muted: true })}
          aria-pressed={settings.muted}
          className={cn(
            "flex-1 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors",
            settings.muted
              ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
              : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
          )}
        >
          {t("mute")}
        </button>
        <button
          type="button"
          onClick={() => {
            apply({ muted: false });
            // Preview: tanpa ini user harus keluar menu untuk tahu seberapa
            // keras volume yang baru dipilih.
            playCue("notify");
          }}
          aria-pressed={!settings.muted}
          className={cn(
            "flex-1 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors",
            !settings.muted
              ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
              : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
          )}
        >
          {t("turnOn")}
        </button>
      </div>

      <Slider
        value={settings.volume}
        onValueChange={(value) => apply({ volume: value })}
        min={0}
        max={100}
        step={5}
        thumbLabel={t("volume")}
        className={settings.muted ? "opacity-60" : undefined}
      >
        <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
          {settings.volume}%
        </span>
      </Slider>
    </div>
  );
}
