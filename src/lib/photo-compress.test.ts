import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { compressPhoto, preparePhoto } from "./photo-compress";
import { MAX_RAW_PHOTO_BYTES } from "./photos";

async function makeImage(width: number, height: number): Promise<File> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 80, b: 200 },
    },
  })
    .png()
    .toBuffer();
  return new File([buffer], "foto.png", { type: "image/png" });
}

describe("compressPhoto", () => {
  it("mengubah ke WebP dan membatasi sisi terpanjang 1600px", async () => {
    const input = await makeImage(2200, 1400);
    const output = await compressPhoto(input);
    const meta = await sharp(Buffer.from(await output.arrayBuffer())).metadata();

    expect(output.type).toBe("image/webp");
    expect(output.name).toBe("foto.webp");
    expect(meta.format).toBe("webp");
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1600);
    expect(output.size).toBeLessThan(input.size);
  });

  it("tidak memperbesar gambar yang lebih kecil dari batas", async () => {
    const output = await compressPhoto(await makeImage(400, 300));
    const meta = await sharp(Buffer.from(await output.arrayBuffer())).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(300);
  });
});

describe("preparePhoto", () => {
  it("menolak file mentah di atas 10MB sebelum diproses", async () => {
    const huge = {
      name: "besar.png",
      type: "image/png",
      size: MAX_RAW_PHOTO_BYTES + 1,
    } as File;
    await expect(preparePhoto(huge)).rejects.toThrow("Ukuran maksimal 10.0 MB");
  });
});
