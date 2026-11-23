import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { compressPhoto, preparePhoto } from "./photo-compress";
import { MAX_RAW_PHOTO_BYTES } from "./photos";

const { mockImages, state } = vi.hoisted(() => {
  const state = { inputCalls: 0 };
  const mockImages = {
    input: (stream: ReadableStream) => {
      state.inputCalls += 1;
      return {
        transform: ({ width, height }: { width: number; height: number }) => ({
          output: async ({ quality }: { quality: number }) => {
            const bytes = Buffer.from(await new Response(stream).arrayBuffer());
            const out = await sharpImport!.default(bytes)
              .resize({ width, height, fit: "inside", withoutEnlargement: true })
              .webp({ quality })
              .toBuffer();
            return { image: () => new Blob([out]).stream() };
          },
        }),
      };
    },
  };
  return { mockImages, state };
});

let sharpImport: typeof import("sharp") | null = null;

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { IMAGES: mockImages } }),
}));

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
  it("mengubah ke WebP dan membatasi sisi terpanjang 1600px lewat binding IMAGES", async () => {
    sharpImport = await import("sharp");
    const input = await makeImage(2200, 1400);
    const output = await compressPhoto(input);
    const meta = await sharp(Buffer.from(await output.arrayBuffer())).metadata();

    expect(output.type).toBe("image/webp");
    expect(output.name).toBe("foto.webp");
    expect(meta.format).toBe("webp");
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1600);
    expect(output.size).toBeLessThan(input.size);
    expect(state.inputCalls).toBeGreaterThan(0);
  });

  it("tidak memperbesar gambar yang lebih kecil dari batas", async () => {
    sharpImport = await import("sharp");
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
