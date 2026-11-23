import { getCloudflareContext } from "@opennextjs/cloudflare";
import { MAX_RAW_PHOTO_BYTES, validatePhotoFile } from "./photos";

export const COMPRESSED_PHOTO_TYPE = "image/webp";
export const COMPRESSED_PHOTO_EXTENSION = "webp";

const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 80;

export class PhotoCompressionError extends Error {}

type ImagesBinding = {
  input: (stream: ReadableStream) => {
    transform: (options: {
      width: number;
      height: number;
      fit: "scale-down";
    }) => {
      output: (options: {
        quality: number;
        format: string;
      }) => Promise<{ image: () => ReadableStream }>;
    };
  };
};

/**
 * Validasi file mentah (maks 10MB) → kompres → pastikan hasil ≤2MB.
 * Dipakai semua server action upload supaya aturan tidak diduplikasi.
 */
export async function preparePhoto(file: File): Promise<File> {
  const raw = validatePhotoFile(file, MAX_RAW_PHOTO_BYTES);
  if (!raw.ok) throw new Error(raw.error);

  const compressed = await compressPhoto(file);
  const result = validatePhotoFile(compressed);
  if (!result.ok) throw new Error(result.error);

  return compressed;
}

/**
 * Kompres foto jadi WebP q80, sisi terpanjang maksimal 1600px (tanpa upscale).
 * Memakai binding IMAGES bawaan Cloudflare Worker: `sharp` adalah modul native
 * yang tidak bisa dimuat di Worker dan membuat seluruh server action gagal.
 */
export async function compressPhoto(file: File): Promise<File> {
  try {
    const { env } = getCloudflareContext();
    const images = (env as { IMAGES?: ImagesBinding }).IMAGES;
    if (!images) throw new Error("Binding IMAGES tidak tersedia");

    const transformed = await images
      .input(file.stream())
      .transform({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "scale-down",
      })
      .output({ quality: WEBP_QUALITY, format: COMPRESSED_PHOTO_TYPE });

    const bytes = await new Response(transformed.image()).arrayBuffer();
    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([bytes], `${baseName}.webp`, { type: COMPRESSED_PHOTO_TYPE });
  } catch (error) {
    throw new PhotoCompressionError(
      `Gagal mengompres foto: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
