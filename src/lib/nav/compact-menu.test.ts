import { describe, expect, it } from "vitest";
import { COMPACT_MENU_HIDDEN_HREFS, operationalEntries } from "./compact-menu";

/**
 * Isi section "Operasional" di drawer compact.
 *
 * Yang dijaga di sini bukan tampilan, melainkan dua hal yang mudah rusak tanpa
 * terlihat: halaman yang hilang dari menu (role kehilangan satu-satunya jalan
 * masuk selain command palette) dan urutan kartu yang berbeda dari frame.
 */
describe("operationalEntries", () => {
  it("teknisi: tiga kartu pertama sesuai frame Figma", () => {
    const hrefs = operationalEntries("TECHNICIAN").map((entry) => entry.href);
    expect(hrefs.slice(0, 3)).toEqual([
      "/app/servis",
      "/app/kategori-sparepart",
      "/app/laporan/servis",
    ]);
  });

  it("teknisi: semua halaman yang boleh dibuka ikut jadi kartu", () => {
    const hrefs = operationalEntries("TECHNICIAN").map((entry) => entry.href);
    expect(hrefs).toEqual([
      "/app/servis",
      "/app/kategori-sparepart",
      "/app/laporan/servis",
      "/app/inventori",
      "/app/garansi",
    ]);
  });

  it("frontliner: Penjualan/Customer/Transaksi ikut, Sparepart tidak", () => {
    const hrefs = operationalEntries("FRONTLINER").map((entry) => entry.href);
    expect(hrefs.slice(0, 3)).toEqual(["/app/servis", "/app/penjualan", "/app/laporan/servis"]);
    expect(hrefs).toContain("/app/customer");
    expect(hrefs).toContain("/app/keuangan/transaksi");
    expect(hrefs).not.toContain("/app/kategori-sparepart");
    expect(hrefs).toHaveLength(10);
  });

  it("Home dan halaman analitik tidak pernah jadi kartu", () => {
    for (const role of ["TECHNICIAN", "FRONTLINER"]) {
      const hrefs = operationalEntries(role).map((entry) => entry.href);
      for (const hidden of COMPACT_MENU_HIDDEN_HREFS) {
        expect(hrefs).not.toContain(hidden);
      }
    }
  });

  it("role tak dikenal tidak menghasilkan kartu, bukan semua kartu", () => {
    expect(operationalEntries("BUKAN_ROLE")).toEqual([]);
    expect(operationalEntries(null)).toEqual([]);
    expect(operationalEntries(undefined)).toEqual([]);
  });
});
