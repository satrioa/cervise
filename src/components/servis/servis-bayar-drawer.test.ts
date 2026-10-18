import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync("src/components/servis/servis-bayar-drawer.tsx", "utf8");

/**
 * Test end-to-end menemukan dua pesan yang saling bertentangan di form yang
 * sama: "Servis ini sudah lunas" dari server, padahal form masih menampilkan
 * "Melebihi sisa estimasi, tapi tetap bisa disimpan".
 *
 * Penyebabnya UI tidak tahu aturan yang sama dengan server:
 * `recordServisPayment` menolak seluruh pembayaran baru begitu
 * `alreadyPaid >= price_estimasi`, tanpa melihat nominalnya. Saat test, nominal
 * 50.000 (di bawah sisa Rp 0) ditolak juga.
 */
describe("form bayar konsisten dengan aturan server", () => {
  it("menyembunyikan field isian saat servis sudah lunas", () => {
    // Menampilkan form yang pasti ditolak hanya membuang waktu kasir dan
    // gelombang error yang tidak perlu terjadi. Field isian ada di dalam
    // cabang `!sudahLunas`, jadi keduanya tidak pernah tampil bersamaan.
    expect(SOURCE).toContain("const sudahLunas = sisa === 0;");
    expect(SOURCE).toContain("{sudahLunas ? (");
    // `Nominal *` hanya boleh berada di cabang else.
    const nominalIndex = SOURCE.indexOf("<Label>Nominal *</Label>");
    const guardIndex = SOURCE.indexOf("{sudahLunas ? (");
    expect(nominalIndex).toBeGreaterThan(guardIndex);
  });

  it("tidak lagi menjanjikan bahwa nominal melebihi sisa bisa disimpan", () => {
    // Kalimat ini benar ketika server menerima semua nominal, tapi tidak
    // sekarang: begitu sisa 0, server menolak apa pun.
    expect(SOURCE).not.toContain("tapi tetap bisa disimpan");
  });

  it("menyatakan alasan penolakan dengan jelas, bukan diam", () => {
    expect(SOURCE).toContain("sudah lunas");
  });
});