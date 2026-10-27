/**
 * Ubah logo jadi bitmap hitam-putih untuk perintah raster ESC/POS.
 *
 * `null` kalau gambar gagal dimuat — nota tetap tercetak tanpa logo, bukan
 * gagal total. Butuh DOM, jadi jangan dipanggil di server.
 */
import type { EscposRaster } from "./escpos";

export async function loadLogoRaster(
  url: string | null | undefined,
  maxWidth = 160,
): Promise<EscposRaster | null> {
  if (!url || typeof document === "undefined") return null;
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("logo gagal dimuat"));
      image.src = url;
    });

    const scale = Math.min(1, maxWidth / image.width);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height).data;

    const widthBytes = Math.ceil(width / 8);
    const data = new Array<number>(widthBytes * height).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const luma = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        if (luma < 160) data[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    return { width, height, data };
  } catch {
    return null;
  }
}
