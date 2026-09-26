"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { TrashIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES, formatBytes, initialsOf, validatePhotoFile } from "@/lib/photos";

type PhotoUploadProps = {
  photoUrl: string | null;
  /** Nama dipakai untuk inisial saat belum ada foto. */
  name: string;
  onUpload: (formData: FormData) => Promise<{ ok: boolean; url?: string | null }>;
  onRemove: () => Promise<{ ok: boolean }>;
  disabled?: boolean;
  label?: string;
};

const ACCEPT = ALLOWED_PHOTO_TYPES.join(",");

/**
 * Kontrol unggah foto profil. Dulu "Upload" di sini hanya membuat object URL
 * lokal lalu membuangnya, jadi fotonya hilang begitu pindah halaman; "Remove"
 * pun hanya menghapus state di layar. Sekarang file benar-benar terkirim ke
 * server action, dan object URL pratinjau selalu dicabut saat tidak dipakai.
 */
export function PhotoUpload({
  photoUrl,
  name,
  onUpload,
  onRemove,
  disabled,
  label = "Foto profil",
}: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  const clearPreview = useCallback(() => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreview(null);
  }, []);

  // Jangan bocorkan object URL ketika komponen dilepas.
  useEffect(() => clearPreview, [clearPreview]);

  const shown = preview ?? photoUrl;

  const handlePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset input supaya memilih file yang sama dua kali tetap men-trigger.
    event.target.value = "";
    if (!file) return;

    const validation = validatePhotoFile(file);
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }

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
      if (result.ok) toast.success(`${label} tersimpan`);
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
      clearPreview();
      toast.success(`${label} dihapus`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus foto");
    } finally {
      setBusy(false);
    }
  };

  return (
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
  );
}
