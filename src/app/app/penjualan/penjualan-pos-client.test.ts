import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  "src/app/app/penjualan/penjualan-pos-client.tsx",
  "utf8",
);

/**
 * Ditemukan lewat test end-to-end retur. Log server menunjukkan
 * `qty retur tidak valid` muncul sebagai `unhandledRejection`:
 * tombol "Proses Retur" memanggil `returnSaleItems` tanpa try/catch, jadi
 * penolakan dari server tidak pernah sampai ke pengguna sebagai toast. Dialog
 * tetap terbuka tanpa penjelasan - kasir menekan ulang dan tidak terjadi
 * apa pun.
 *
 * Penyebabnya `handleRetur` di file yang sama sudah lengkap dengan try/catch
 * dan validasi "Pilih qty retur", tapi tombolnya menulis ulang logikanya
 * inline. Versi inline-nya kehilangan keduanya.
 */
describe("tombol Proses Retur melaporkan kegagalan ke pengguna", () => {
  it("memakai handleRetur, bukan menulis ulang logikanya inline", () => {
    expect(SOURCE).toMatch(/onClick=\{handleRetur\}/);
    // Tidak boleh ada handler inline yang memanggil returnSaleItems langsung.
    const inline = SOURCE.match(
      /onClick=\{async \(\) => \{[^}]*returnSaleItems/g,
    );
    expect(inline, "tombol retur tidak boleh memanggil returnSaleItems inline")
      .toBeNull();
  });

  it("handleRetur punya try/catch agar error server jadi toast", () => {
    const start = SOURCE.indexOf("const handleRetur = async () =>");
    expect(start, "handleRetur harus ada").toBeGreaterThan(0);
    const body = SOURCE.slice(start, SOURCE.indexOf("};", start));
    expect(body).toContain("catch");
    expect(body).toContain("toast.error");
    expect(body).toContain("returnSaleItems");
  });

  it("menolak submit kosong dengan pesan, bukan diam", () => {
    const start = SOURCE.indexOf("const handleRetur = async () =>");
    const body = SOURCE.slice(start, SOURCE.indexOf("};", start));
    expect(body).toContain("if (!rets.length)");
    expect(body).toContain("Pilih qty retur");
  });

  it("handleRetur bukan lagi kode mati - ada yang memanggilnya", () => {
    const calls = SOURCE.match(/handleRetur\b/g) ?? [];
    // Tepat dua: satu deklarasi + satu pemanggilan. Tambahnya lagi berarti
    // ada salinan logika inline yang muncul lagi.
    expect(calls.length).toBe(2);
    // `handleReturOpen` tidak ikut terhitung, dan memang tidak seharusnya.
    expect(SOURCE).toContain("const handleReturOpen");
  });
});