"use client";

import { Volume2Icon, VolumeXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_SOUND,
  sfx,
  useSoundSettings,
  writeSoundSettings,
} from "@/lib/sound";

/**
 * Toggle mute sistem suara UI — pintasan cepat di header.
 *
 * Kontrol lengkap (mute + slider volume) ada di section "Sound System" pada
 * drawer menu (`MenuSound` di shell baru). Keduanya membaca/menulis store yang
 * sama (`cervise-sound`), jadi selalu sinkron.
 *
 * - Klik saat sedang OFF → suara aktif kembali, lalu chime berbunyi sebagai
 *   konfirmasi (sekaligus tes cepat bahwa audio memang bekerja). Volume 0
 *   dinaikkan ke default supaya chime-nya terdengar.
 * - Klik saat sedang ON → hening total; tidak ada suara konfirmasi supaya
 *   pengguna yang baru mematikan suara tidak mendengar satu bunyi terakhir.
 */
export function SoundToggle({ className }: { className?: string }) {
  const settings = useSoundSettings();
  const enabled = !settings.muted;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      // Suara feedback ditangani manual di bawah (chime hanya saat menyalakan).
      sound={null}
      aria-label={enabled ? "Matikan suara UI" : "Nyalakan suara UI"}
      title={
        enabled
          ? `Suara UI aktif (${settings.volume}%) — klik untuk mematikan`
          : "Suara UI nonaktif — klik untuk menyalakan"
      }
      onClick={() => {
        if (enabled) {
          writeSoundSettings({ ...settings, muted: true });
          return;
        }
        writeSoundSettings({
          muted: false,
          volume: settings.volume > 0 ? settings.volume : DEFAULT_SOUND.volume,
        });
        sfx.success();
      }}
    >
      {enabled ? <Volume2Icon className="size-4" /> : <VolumeXIcon className="size-4" />}
    </Button>
  );
}
