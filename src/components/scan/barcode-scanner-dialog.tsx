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

        const buildCandidates = async () => {
          const hi = { width: { ideal: 1280 }, height: { ideal: 720 } };
          const base: Array<string | MediaTrackConstraints> = [
            { facingMode: { ideal: "environment" }, ...hi },
            { facingMode: "environment", ...hi },
            { facingMode: "user", ...hi },
          ];
          try {
            const cameras = await Html5Qrcode.getCameras();
            for (const cam of cameras ?? []) {
              base.push({ deviceId: { exact: cam.id }, ...hi });
              base.push(cam.id);
            }
          } catch {
            /* getCameras opsional; lanjut dengan facingMode */
          }
          return base;
        };

        const tryModes = [true, false];
        let started = false;
        let lastError: unknown = null;

        for (const useNative of tryModes) {
          if (cancelled || started) break;
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
            void instance
              .stop()
              .catch(() => {})
              .then(() => {
                try {
                  instance.clear();
                } catch {
                  /* ignore */
                }
                try {
                  detected.current(value);
                } finally {
                  changeOpen.current(false);
                }
              });
          };

          const candidates = await buildCandidates();
          for (const cam of candidates) {
            if (cancelled) return;
            try {
              await instance.start(cam as any, config, onSuccess, () => {
                /* frame tanpa kode */
              });
              started = true;
              break;
            } catch (e) {
              lastError = e;
            }
          }

          if (started) {
            if (cancelled) {
              await instance.stop().catch(() => {});
              try {
                instance.clear();
              } catch {
                /* ignore */
              }
            }
            break;
          }

          try {
            instance.clear();
          } catch {
            /* ignore */
          }
          scanner = null;
        }

        if (!started) throw lastError ?? new Error("Tidak ada kamera yang bisa dibuka");
      } catch (cause) {
        if (!cancelled) {
          const msg = cause instanceof Error ? cause.message : String(cause ?? "");
          setError(
            /permission|denied|notallowed/i.test(msg)
              ? "Izin kamera ditolak. Izinkan akses kamera lalu coba lagi."
              : "Kamera tidak bisa dibuka/digunakan. Izinkan akses kamera, gunakan HTTPS, atau pilih kamera lain lalu coba lagi.",
          );
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      void scanner
        ?.stop()
        .catch(() => {})
        .then(() => {
          try {
            scanner?.clear();
          } catch {
            /* ignore */
          }
        });
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
