"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { TrashIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ImageCropDialog } from "@/components/image-crop-dialog";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES, formatBytes, initialsOf, validatePhotoFile } from "@/lib/photos";
import { playPageTransition } from "@/components/layout/page-transition";

type PhotoUploadProps = {
  photoUrl: string | null;
  /** Nama dipakai untuk inisial saat belum ada foto. */
  name: string;
  onUpload: (formData: FormData) => Promise<{ ok: boolean; url?: string | null }>;
  onRemove: () => Promise<{ ok: boolean }>;
  disabled?: boolean;
  label?: string;
  /** Rasio crop (lebar/tinggi). Default 1:1 untuk avatar. */
  cropAspect?: number;
};

const ACCEPT = ALLOWED_PHOTO_TYPES.join(",");

/**
 * Kontrol unggah foto profil. File dipilih, dipotong (crop) sesuai rasio,
 * lalu dikirim ke server action. Object URL pratinjau selalu dicabut saat
 * tidak dipakai.
 */
export function PhotoUpload({
  photoUrl,
  name,
  onUpload,
  onRemove,
  disabled,
  label = "Foto profil",
  cropAspect = 1,
}: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropMeta, setCropMeta] = useState<{ name: string; type: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const cropSrcRef = useRef<string | null>(null);

  const clearPreview = useCallback(() => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreview(null);
  }, []);

  const clearCropSrc = useCallback(() => {
    if (cropSrcRef.current) {
      URL.revokeObjectURL(cropSrcRef.current);
      cropSrcRef.current = null;
    }
    setCropSrc(null);
    setCropMeta(null);
  }, []);

  // Jangan bocorkan object URL ketika komponen dilepas.
  useEffect(() => () => { clearPreview(); clearCropSrc(); }, [clearPreview, clearCropSrc]);

  const shown = preview ?? photoUrl;

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset input supaya memilih file yang sama dua kali tetap men-trigger.
    event.target.value = "";
    if (!file) return;

    const validation = validatePhotoFile(file);
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }

    clearCropSrc();
    const url = URL.createObjectURL(file);
    cropSrcRef.current = url;
    setCropSrc(url);
    setCropMeta({ name: file.name, type: file.type });
    setCropOpen(true);
  };

  const handleCropComplete = async (file: File) => {
    setCropOpen(false);
    clearCropSrc();

    clearPreview();
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setPreview(url);

    const formData = new FormData();
    formData.append("file", file);

    setBusy(true);
    try {
      const result = await onUpload(formData);
      clearPreview();
      if (result.ok) { playPageTransition(); toast.success(`${label} tersimpan`); }
      else toast.error("Gagal menyimpan foto");
    } catch (error) {
      clearPreview();
      toast.error(error instanceof Error ? error.message : "Gagal mengunggah foto");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await onRemove();
      playPageTransition();
      clearPreview();
      toast.success(`${label} dihapus`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus foto");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-5">
        <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground ring-1 ring-border/60">
          {shown ? (
            <Image src={shown} alt={name || label} fill sizes="80px" unoptimized className="object-cover" />
          ) : (
            <span className="text-lg">{initialsOf(name)}</span>
          )}
        </span>

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              disabled={disabled || busy}
              onClick={() => fileRef.current?.click()}
            >
              <UploadIcon />
              {busy ? "Mengunggah..." : "Upload"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              disabled={disabled || busy || (!photoUrl && !preview)}
              onClick={handleRemove}
            >
              <TrashIcon />
              Remove
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            JPG, PNG, atau WEBP, maksimal {formatBytes(MAX_PHOTO_BYTES)}. Disarankan 400&times;400.
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={disabled || busy}
          onChange={handlePick}
        />
      </div>

      <ImageCropDialog
        open={cropOpen}
        src={cropSrc}
        aspect={cropAspect}
        title={`Potong ${label.toLowerCase()}`}
        description={cropAspect === 1 ? "Sesuaikan area persegi (1:1)." : "Sesuaikan area gambar."}
        fileName={cropMeta?.name}
        mimeType={cropMeta?.type}
        onOpenChange={(next) => {
          if (!next) { setCropOpen(false); clearCropSrc(); }
        }}
        onComplete={(file) => void handleCropComplete(file)}
      />
    </>
  );
}
