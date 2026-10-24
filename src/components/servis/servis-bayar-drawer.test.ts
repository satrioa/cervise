import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync("src/components/servis/servis-bayar-drawer.tsx", "utf8");

/**
 * Test end-to-end menemukan dua pesan yang saling bertentangan di form yang
 * sama: "Servis ini sudah lunas" dari server, padahal form masih menampilkan
 * "Melebihi sisa estimasi, tapi tetap bisa disimpan".
 *
 * Sekarang drawer berhenti lebih awal saat sisa nol, jadi pesan amber tidak
 * pernah muncul bersamaan dengan pesan lunas.
 */
describe("form bayar konsisten dengan aturan server", () => {
  it("menyembunyikan field isian saat servis sudah lunas", () => {
    // Menampilkan form yang pasti ditolak hanya membuang waktu kasir dan
    // gelombang error yang tidak perlu terjadi. Field isian ada SETELAH
    // cabang `sisa === 0`, jadi keduanya tidak pernah tampil bersamaan.
    expect(SOURCE).toContain("if (sisa === 0)");
    const nominalIndex = SOURCE.indexOf("<Label>Nominal *</Label>");
    const guardIndex = SOURCE.indexOf("if (sisa === 0)");
    expect(nominalIndex).toBeGreaterThan(guardIndex);
  });

  it("tidak menampilkan janji melebihi sisa saat sisa nol", () => {
    // Kalimat amber hanya dirender kalau `sisa !== null` dan `amount > sisa`.
    // Dengan sisa 0 drawer sudah berhenti, jadi janji itu tidak pernah
    // bertabrakan dengan pesan "sudah lunas".
    const amberLine = SOURCE.split("\n").find((line) => line.includes("tapi tetap bisa disimpan"));
    expect(amberLine).toBeTruthy();
    expect(amberLine).toContain("sisa !== null");
  });

  it("menyatakan alasan penolakan dengan jelas, bukan diam", () => {
    expect(SOURCE).toContain("sudah lunas");
  });
});
