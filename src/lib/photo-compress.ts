import sharp from "sharp";
import { MAX_RAW_PHOTO_BYTES, validatePhotoFile } from "./photos";

export const COMPRESSED_PHOTO_TYPE = "image/webp";
export const COMPRESSED_PHOTO_EXTENSION = "webp";

const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 80;

export class PhotoCompressionError extends Error {}

/**
 * Validasi file mentah (maks 10MB) → kompres → pastikan hasil ≤2MB.
 * Dipakai semua server action upload supaya aturannya tidak diduplikasi.
 */
export async function preparePhoto(file: File): Promise<File> {
  const raw = validatePhotoFile(file, MAX_RAW_PHOTO_BYTES);
  if (!raw.ok) throw new Error(raw.error);

  const compressed = await compressPhoto(file);
  const result = validatePhotoFile(compressed);
  if (!result.ok) throw new Error(result.error);

  return compressed;
}

/** Kompres foto jadi WebP q80, sisi terpanjang maksimal 1600px (tanpa upscale). */
export async function compressPhoto(file: File): Promise<File> {
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const output = await sharp(input, { failOn: "error" })
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([output], `${baseName}.webp`, { type: COMPRESSED_PHOTO_TYPE });
  } catch (error) {
    throw new PhotoCompressionError(
      `Gagal mengompres foto: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
