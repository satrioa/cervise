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

    void (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;

        const instance = new Html5Qrcode(regionId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
        });
        scanner = instance;

        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 140 }, aspectRatio: 1.333 },
          (decodedText) => {
            const value = decodedText?.trim();
            if (!value || handled) return;
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
          },
          () => {
            /* frame tanpa kode: abaikan agar tetap "Mencari barcode…" */
          },
        );

        if (cancelled) {
          await instance.stop().catch(() => {});
          try {
            instance.clear();
          } catch {
            /* ignore */
          }
        }
      } catch {
        if (!cancelled) {
          setError(
            "Kamera tidak bisa dibuka. Izinkan akses kamera, atau gunakan scanner USB.",
          );
        }
      }
    })();

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
            className="size-full [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover [&_img]:hidden [&>div]:!h-full [&>div]:!w-full"
          />
          {error ? (
            <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-white/80">
              {error}
            </p>
          ) : (
            <>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-1/3 w-4/5 rounded-lg border-2 border-white/70" />
              </div>
              <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] text-white">
                <Loader2 className="size-3 animate-spin" />
                Mencari barcode…
              </span>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
