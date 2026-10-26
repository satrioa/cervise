import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync("src/components/servis/servis-payment-panel.tsx", "utf8");

/**
 * Pembayaran servis memakai panel yang sama dengan penjualan. Yang dijaga di
 * sini:
 * - servis lunas tidak lagi menampilkan form yang pasti ditolak server;
 * - panel penjualan dipakai apa adanya (bukan form terpisah yang melar);
 * - kode promo tidak ikut, karena diskon penjualan tidak berlaku untuk servis.
 */
describe("pembayaran servis mengikuti pembayaran penjualan", () => {
  it("menyembunyikan form saat servis sudah lunas", () => {
    expect(SOURCE).toContain("sisa === 0");
    expect(SOURCE).toContain("sudah lunas");
    // Form pembayaran hanya dirender setelah cabang lunas dilewati.
    const guardIndex = SOURCE.indexOf("sisa === 0");
    const panelIndex = SOURCE.indexOf("<PenjualanPaymentPanel");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(panelIndex).toBeGreaterThan(guardIndex);
  });

  it("memakai panel pembayaran penjualan", () => {
    expect(SOURCE).toContain("PenjualanPaymentPanel");
    expect(SOURCE).toContain('submitLabel="Simpan Pembayaran"');
  });

  it("tidak membawa kode promo ke servis", () => {
    expect(SOURCE).toContain("showPromo={false}");
  });

  it("nominal tanpa estimasi diisi manual", () => {
    expect(SOURCE).toContain("punyaEstimasi");
    expect(SOURCE).toContain("manualAmount");
  });
});
