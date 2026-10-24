"use client";

import { Volume2Icon, VolumeXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setSoundEnabled, sfx, useSoundEnabled } from "@/lib/sound";

/**
 * Toggle mute sistem suara UI.
 *
 * - Klik saat sedang OFF → semua efek suara aktif kembali, lalu chime berbunyi
 *   sebagai konfirmasi (sekaligus tes cepat bahwa audio memang bekerja).
 * - Klik saat sedang ON → hening total; tidak ada suara konfirmasi supaya
 *   pengguna yang baru mematikan suara tidak mendengar satu bunyi terakhir.
 *
 * Preferensi disimpan oleh `src/lib/sound.ts` (localStorage `cervise_sound`).
 */
export function SoundToggle({ className }: { className?: string }) {
  const enabled = useSoundEnabled();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      // Suara feedback ditangani manual di bawah (chime hanya saat menyalakan).
      sound={null}
      aria-label={enabled ? "Matikan suara UI" : "Nyalakan suara UI"}
      title={enabled ? "Suara UI aktif — klik untuk mematikan" : "Suara UI nonaktif — klik untuk menyalakan"}
      onClick={() => {
        if (enabled) {
          setSoundEnabled(false);
        } else {
          setSoundEnabled(true);
          sfx.success();
        }
      }}
    >
      {enabled ? <Volume2Icon className="size-4" /> : <VolumeXIcon className="size-4" />}
    </Button>
  );
}
