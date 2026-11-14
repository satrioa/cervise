"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MAX_PHOTO_BYTES } from "@/lib/photos";

type Props = {
  open: boolean;
  /** Object URL sumber gambar. */
  src: string | null;
  /** Rasio lebar/tinggi, mis. 1 untuk persegi, 2 untuk 2:1. */
  aspect: number;
  title?: string;
  description?: string;
  /** Nama file asal (dipakai saat membuat File hasil crop). */
  fileName?: string;
  /** MIME asal; hasil diekspor ke JPEG/PNG/WEBP yang didukung. */
  mimeType?: string;
  onOpenChange: (open: boolean) => void;
  onComplete: (file: File) => void;
};

function outputType(mime?: string): "image/jpeg" | "image/png" | "image/webp" {
  if (mime === "image/png" || mime === "image/webp") return mime;
  return "image/jpeg";
}

function extFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

async function createImage(url: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("Gagal memuat gambar")));
    image.src = url;
  });
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: "image/jpeg" | "image/png" | "image/webp",
  quality?: number,
): Promise<Blob> {
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal memproses gambar"))),
      type,
      quality,
    );
  });
}

async function getCroppedFile(
  src: string,
  crop: Area,
  fileName: string,
  mime?: string,
): Promise<File> {
  const image = await createImage(src);
  const canvas = document.createElement("canvas");
  // Batasi dimensi agar hasil tetap ringan.
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(crop.width, crop.height));
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Gagal menyiapkan gambar");

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const type = outputType(mime);
  let quality = type === "image/jpeg" ? 0.92 : undefined;
  let blob = await canvasToBlob(canvas, type, quality);

  // Kecilkan bertahap jika masih di atas batas unggah.
  while (blob.size > MAX_PHOTO_BYTES && quality !== undefined && quality > 0.5) {
    quality = Math.max(0.5, quality - 0.1);
    blob = await canvasToBlob(canvas, type, quality);
  }
  if (blob.size > MAX_PHOTO_BYTES && canvas.width > 512) {
    const shrink = document.createElement("canvas");
    shrink.width = Math.max(1, Math.round(canvas.width * 0.75));
    shrink.height = Math.max(1, Math.round(canvas.height * 0.75));
    const sctx = shrink.getContext("2d");
    if (sctx) {
      sctx.drawImage(canvas, 0, 0, shrink.width, shrink.height);
      blob = await canvasToBlob(shrink, type, quality);
    }
  }

  const base = fileName.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.${extFor(type)}`, { type });
}

export function ImageCropDialog({
  open,
  src,
  aspect,
  title = "Sesuaikan gambar",
  description = "Geser dan perbesar untuk memilih area.",
  fileName = "image.jpg",
  mimeType,
  onOpenChange,
  onComplete,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setArea(null);
      setError(null);
    }
  }, [open, src]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  const confirm = async () => {
    if (!src || !area) return;
    setBusy(true);
    setError(null);
    try {
      const file = await getCroppedFile(src, area, fileName, mimeType);
      if (file.size > MAX_PHOTO_BYTES) {
        throw new Error("Hasil crop masih terlalu besar. Coba area lebih kecil atau gambar lain.");
      }
      onComplete(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memotong gambar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="relative h-72 w-full overflow-hidden rounded-lg bg-black/90 sm:h-80">
          {src ? (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
            disabled={busy || !src}
            aria-label="Zoom"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button type="button" onClick={() => void confirm()} disabled={busy || !src || !area}>
            {busy ? "Memproses..." : "Gunakan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
