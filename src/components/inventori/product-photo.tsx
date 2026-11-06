"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CameraIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  formatBytes,
  publicPhotoUrl,
  validatePhotoFile,
} from "@/lib/photos";
import { productThumbnail } from "@/lib/product-thumbnail";
import { uploadProductPhoto } from "@/app/app/inventori/photo-actions";
import { playPageTransition } from "@/components/layout/page-transition";

const ACCEPT = ALLOWED_PHOTO_TYPES.join(",");

function Preview({ src, alt, fallback }: { src: string | null; alt: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      src={!failed && src ? src : fallback}
      alt={alt}
      fill
      sizes="80px"
      unoptimized
      onError={() => setFailed(true)}
      className="object-cover"
    />
  );
}

/** Pilih foto sebelum produk dibuat. File baru diunggah setelah produk punya id. */
export function ProductPhotoPicker({
  value,
  onFile,
  disabled,
}: {
  value: string | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const clearPreview = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreview(null);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/30">
        <Preview src={preview ?? value} alt="Foto produk" fallback={productThumbnail({ variantType: "BARU" })} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()}>
            <CameraIcon /> {preview ? "Ganti foto" : "Pilih foto"}
          </Button>
          {preview ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => { clearPreview(); onFile(null); }}
            >
              <XIcon /> Hapus
            </Button>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">
          JPG, PNG, atau WEBP, maksimal {formatBytes(MAX_PHOTO_BYTES)}.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
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
          onFile(file);
        }}
      />
    </div>
  );
}

/** Foto untuk produk yang sudah ada; klik untuk mengganti. */
export function ProductPhotoButton({
  productId,
  imageUrl,
  name,
  variantType,
  category,
  className = "size-10",
}: {
  productId: string;
  imageUrl: string | null;
  name: string;
  variantType?: string | null;
  category?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", imageUrl);

  return (
    <div className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        aria-label={`Ganti foto ${name}`}
        title="Ganti foto"
        className="relative flex size-full items-center justify-center overflow-hidden rounded-lg border bg-muted/30 transition-colors hover:bg-muted/50 disabled:opacity-50"
      >
        <Image
          src={!failed && src ? src : productThumbnail({ variantType, category })}
          alt={name}
          fill
          sizes="80px"
          unoptimized
          onError={() => setFailed(true)}
          className="object-cover"
        />
        <span className="absolute bottom-0 right-0 flex size-4 items-center justify-center rounded-tl-md bg-background/90 text-muted-foreground">
          <CameraIcon className="size-2.5" />
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={busy}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const validation = validatePhotoFile(file);
          if (!validation.ok) {
            toast.error(validation.error);
            return;
          }
          const formData = new FormData();
          formData.append("file", file);
          setBusy(true);
          try {
            await uploadProductPhoto(productId, formData);
            playPageTransition();
            setFailed(false);
            toast.success("Foto produk tersimpan");
            router.refresh();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal mengunggah foto");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
