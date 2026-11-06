"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ScannerControls = { stop: () => void };

/**
 * Dialog kamera untuk scan barcode.
 *
 * `@zxing/browser` diimpor dinamis saat dialog dibuka: paketnya besar
 * (~120KB gzip) dan tidak tree-shakeable, jadi tidak boleh ikut bundle awal
 * halaman POS. `BarcodeDetector` sengaja tidak dipakai karena tidak ada di
 * Safari/iOS.
 *
 * `onDetected` disimpan di ref supaya effect tidak perlu ikut re-run setiap
 * render induk — kamera cukup dibuka sekali per `open`.
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const detected = useRef(onDetected);
  const changeOpen = useRef(onOpenChange);

  useEffect(() => {
    detected.current = onDetected;
    changeOpen.current = onOpenChange;
  }, [onDetected, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setError(null);

    let controls: ScannerControls | null = null;
    let cancelled = false;
    let handled = false;

    void (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const video = videoRef.current;
        if (cancelled || !video) return;

        controls = await new BrowserMultiFormatReader().decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video,
          (result) => {
            const value = result?.getText().trim();
            if (!value || handled) return;
            handled = true;
            controls?.stop();
            detected.current(value);
            changeOpen.current(false);
          },
        );
        if (cancelled) controls.stop();
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
      controls?.stop();
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 p-0 sm:max-w-sm">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[4/3] w-full overflow-hidden bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className="size-full object-cover"
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
