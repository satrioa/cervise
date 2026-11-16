"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Dialog kamera untuk scan barcode.
 *
 * `html5-qrcode` diimpor dinamis saat dialog dibuka agar tidak ikut bundle awal
 * halaman POS. `onDetected`/`onOpenChange` disimpan di ref supaya kamera cukup
 * dibuka sekali per `open`.
 */
export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onDetected,
  title = "Scan barcode",
  description = "Arahkan kamera ke barcode.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (value: string) => void;
  title?: string;
  description?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const detected = useRef(onDetected);
  const changeOpen = useRef(onOpenChange);
  const uid = useId().replace(/:/g, "");
  const regionId = `barcode-scan-${uid}`;

  useEffect(() => {
    detected.current = onDetected;
    changeOpen.current = onOpenChange;
  }, [onDetected, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setError(null);

    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let cancelled = false;
    let handled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const start = async () => {
      // Tunggu elemen dialog ter-mount dan punya ukuran sebelum kamera dibuka.
      await new Promise((r) => setTimeout(r, 200));
      if (cancelled) return;
      const el = document.getElementById(regionId);
      if (!el) {
        if (!cancelled) setError("Area kamera tidak siap. Tutup lalu coba lagi.");
        return;
      }

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;

        const formatsToSupport = [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.QR_CODE,
        ];

        const config = {
          fps: 15,
          aspectRatio: 1.333334,
          // Strip lebar untuk barcode 1D (Code128/EAN) agar fokus dan tajam.
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const w = Math.floor(viewfinderWidth * 0.92);
            const h = Math.floor(viewfinderHeight * 0.38);
            return { width: Math.max(240, w), height: Math.max(90, Math.min(h, 220)) };
          },
          disableFlip: false,
        };

        const candidates = await (async () => {
          const hi = { width: { ideal: 1280 }, height: { ideal: 720 } };
          const base: Array<string | MediaTrackConstraints> = [
            { facingMode: { ideal: "environment" }, ...hi },
            { facingMode: "environment", ...hi },
            { facingMode: "user", ...hi },
            { facingMode: { ideal: "environment" } },
            { facingMode: "environment" },
            { facingMode: "user" },
          ];
          try {
            const cameras = await Html5Qrcode.getCameras();
            for (const cam of cameras ?? []) {
              base.push({ deviceId: { exact: cam.id }, ...hi });
              base.push({ deviceId: { exact: cam.id } });
              base.push(cam.id);
            }
          } catch {
            /* getCameras opsional; lanjut dengan facingMode */
          }
          const seen = new Set<string>();
          return base.filter((c) => {
            const k = typeof c === "string" ? `id:${c}` : JSON.stringify(c);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        })();

        const isTransitionError = (e: unknown) => /transition/i.test(e instanceof Error ? e.message : String(e ?? ""));
        let firstMeaningful: unknown = null;
        let lastError: unknown = null;
        const safeStop = async (instance: { stop: () => Promise<void> }) => {
          try { await instance.stop(); } catch { /* ignore - e.g. not running/paused */ }
        };

        const cleanupInstance = async (instance: { stop: () => Promise<void>; clear: () => void }) => {
          await safeStop(instance);
          try { instance.clear(); } catch { /* ignore */ }
          if (scanner === instance) scanner = null;
        };

        const runMode = async (useNative: boolean): Promise<boolean> => {
          for (const cam of candidates) {
            if (cancelled || handled) return false;
            const instance = new Html5Qrcode(regionId, {
              verbose: false,
              formatsToSupport,
              useBarCodeDetectorIfSupported: useNative,
            });
            scanner = instance;

            const onSuccess = (decodedText: string) => {
              const value = decodedText?.trim();
              if (!value || handled || cancelled) return;
              handled = true;
              if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
              void (async () => {
                await safeStop(instance);
                try { instance.clear(); } catch { /* ignore */ }
                if (scanner === instance) scanner = null;
                try {
                  detected.current(value);
                } catch (e) {
                  console.error("[barcode-scan] onDetected failed", e);
                } finally {
                  changeOpen.current(false);
                }
              })();
            };

            try {
              await instance.start(cam as any, config, onSuccess, () => {
                /* frame tanpa kode */
              });
              if (handled) return true;
              if (cancelled) {
                await cleanupInstance(instance);
                return false;
              }
              if (useNative) {
                // Native BarcodeDetector kadang tidak decode barcode tertentu; fallback ke ZXing jika lama tak terbaca.
                fallbackTimer = setTimeout(() => {
                  if (cancelled || handled) return;
                  void (async () => {
                    await cleanupInstance(instance);
                    if (cancelled || handled) return;
                    const ok = await runMode(false);
                    if (!ok && !cancelled && !handled) {
                      const cause = firstMeaningful ?? lastError ?? new Error("Tidak ada kamera yang bisa dibuka");
                      const name = (cause && typeof cause === "object" && "name" in cause && typeof (cause as any).name === "string") ? (cause as any).name : "";
                      const msg = cause instanceof Error ? cause.message : String(cause ?? "");
                      let friendly = "Kamera tidak bisa dibuka/digunakan. Izinkan akses kamera, gunakan HTTPS, atau pilih kamera lain lalu coba lagi.";
                      if (/NotAllowed|Permission|denied/i.test(name + " " + msg)) friendly = "Izin kamera ditolak. Izinkan akses kamera di browser lalu coba lagi.";
                      else if (/NotFound|DevicesNotFound/i.test(name + " " + msg)) friendly = "Kamera tidak ditemukan di perangkat ini.";
                      else if (/NotReadable|TrackStartError|Could not start video source/i.test(name + " " + msg)) friendly = "Kamera sedang dipakai aplikasi/tab lain atau tidak bisa diakses. Tutup aplikasi lain yang memakai kamera lalu coba lagi.";
                      else if (/Overconstrained|Constraint/i.test(name + " " + msg)) friendly = "Pengaturan kamera tidak didukung perangkat. Coba kamera lain.";
                      else if (/Security|secure/i.test(msg) || (typeof window !== "undefined" && !window.isSecureContext)) friendly = "Kamera butuh koneksi aman (HTTPS) atau localhost.";
                      const detail = [name, msg].filter(Boolean).join(": ");
                      setError(detail ? `${friendly} (${detail})` : friendly);
                    }
                  })();
                }, 7000);
              }
              return true;
            } catch (e) {
              lastError = e;
              if (!isTransitionError(e) && !firstMeaningful) firstMeaningful = e;
              await cleanupInstance(instance);
            }
          }
          return false;
        };

        const started = await runMode(true);
        if (!started && !cancelled && !handled) {
          // native gagal start di semua kandidat, coba ZXing
          const zxOk = await runMode(false);
          if (!zxOk) throw firstMeaningful ?? lastError ?? new Error("Tidak ada kamera yang bisa dibuka");
        } else if (cancelled || handled) {
          if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
        }
      } catch (cause) {
        if (!cancelled) {
          const name = (cause && typeof cause === "object" && "name" in cause && typeof (cause as any).name === "string") ? (cause as any).name : "";
          const msg = cause instanceof Error ? cause.message : String(cause ?? "");
          let friendly = "Kamera tidak bisa dibuka/digunakan. Izinkan akses kamera, gunakan HTTPS, atau pilih kamera lain lalu coba lagi.";
          if (/NotAllowed|Permission|denied/i.test(name + " " + msg)) {
            friendly = "Izin kamera ditolak. Izinkan akses kamera di browser lalu coba lagi.";
          } else if (/NotFound|DevicesNotFound/i.test(name + " " + msg)) {
            friendly = "Kamera tidak ditemukan di perangkat ini.";
          } else if (/NotReadable|TrackStartError|Could not start video source/i.test(name + " " + msg)) {
            friendly = "Kamera sedang dipakai aplikasi/tab lain atau tidak bisa diakses. Tutup aplikasi lain yang memakai kamera lalu coba lagi.";
          } else if (/Overconstrained|Constraint/i.test(name + " " + msg)) {
            friendly = "Pengaturan kamera tidak didukung perangkat. Coba kamera lain.";
          } else if (/Security|secure/i.test(msg) || (typeof window !== "undefined" && !window.isSecureContext)) {
            friendly = "Kamera butuh koneksi aman (HTTPS) atau localhost.";
          }
          const detail = [name, msg].filter(Boolean).join(": ");
          setError(detail ? `${friendly} (${detail})` : friendly);
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
      const inst = scanner;
      scanner = null;
      if (inst) {
        void (async () => {
          try { await inst.stop(); } catch { /* ignore - e.g. not running/paused */ }
          try { inst.clear(); } catch { /* ignore */ }
        })();
      }
    };
  }, [open, regionId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 p-0 sm:max-w-sm">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
          <div
            id={regionId}
            className="size-full [&_video]:!h-full [&_video]:!w-full [&_video]:!object-contain [&_img]:hidden"
          />
          {error ? (
            <p className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-4 text-center text-xs text-white/90">
              {error}
            </p>
          ) : (
            <span className="pointer-events-none absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] text-white">
              <Loader2 className="size-3 animate-spin" />
              Mencari barcode...
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
