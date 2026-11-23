import { describe, expect, it } from "vitest";
import { barcodeRaster } from "./barcode-raster";

describe("barcode raster thermal", () => {
  it("menghasilkan bitmap 1-bit dengan quiet zone", () => {
    const raster = barcodeRaster("2026-0042");
    expect(raster).not.toBeNull();
    expect(raster!.width % 8).toBe(0);
    expect(raster!.width).toBeLessThanOrEqual(384);
    expect(raster!.data.length).toBe((raster!.width / 8) * raster!.height);
    // Baris pertama diawali quiet zone putih.
    expect(raster!.data[0]).toBe(0);
    // Di tengah ada bar hitam.
    expect(raster!.data.some((byte) => byte !== 0)).toBe(true);
  });

  it("mengecilkan modul agar muat kertas 58mm", () => {
    const wide = barcodeRaster("SRV-2026-000042", { maxWidth: 384 });
    expect(wide!.width).toBeLessThanOrEqual(384);
  });

  it("mengembalikan null untuk nilai kosong", () => {
    expect(barcodeRaster("")).toBeNull();
  });
});
