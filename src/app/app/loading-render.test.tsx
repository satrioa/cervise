import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LaporanServis from "./laporan/servis/loading";
import LaporanPenjualan from "./laporan/penjualan/loading";
import LaporanKeuangan from "./laporan/keuangan/loading";
import LaporanPerforma from "./laporan/performa/loading";
import LaporanShift from "./laporan/shift/loading";
import Garansi from "./garansi/loading";
import Transaksi from "./keuangan/transaksi/loading";
import Usage from "./pengaturan/usage/loading";
import Penjualan from "./penjualan/loading";
import Servis from "./servis/loading";
import Customer from "./customer/loading";
import AuditLog from "./audit-log/loading";
import Analitik from "./analitik-servis/loading";
import Global from "./loading";

/**
 * `loading.tsx` dirender server-side (tanpa JS). Kalau ada yang salah -
 * impor salah, komponen tidak ditemukan, JSX rusak - route-nya crash saat
 * perpindahan halaman, bukan saat build.
 *
 * Test ini merender semua file sekaligus supaya masalahnya ketahuan di test,
 * bukan di tangan pengguna.
 */
const ROUTES: [string, () => React.ReactElement][] = [
  ["laporan/servis", LaporanServis],
  ["laporan/penjualan", LaporanPenjualan],
  ["laporan/keuangan", LaporanKeuangan],
  ["laporan/performa", LaporanPerforma],
  ["laporan/shift", LaporanShift],
  ["garansi", Garansi],
  ["keuangan/transaksi", Transaksi],
  ["pengaturan/usage", Usage],
  ["penjualan", Penjualan],
  ["servis", Servis],
  ["customer", Customer],
  ["audit-log", AuditLog],
  ["analitik-servis", Analitik],
  ["(global)", Global],
];

describe("loading.tsx route", () => {
  it("semua route render tanpa error dan menghasilkan skeleton Dither", () => {
    for (const [name, Component] of ROUTES) {
      const html = renderToStaticMarkup(<Component />);
      expect(html.length, `${name} tidak menghasilkan markup`).toBeGreaterThan(200);
      // `ars` = kelas dari ascii-reveal; tanpanya tidak ada pola Dither.
      expect(html, `${name} tidak punya skeleton ASCII`).toContain("ars");
    }
  });

  it("loading.tsx tidak menampilkan spinner atau teks 'memuat' yang terlihat", () => {
    for (const [name, Component] of ROUTES) {
      const html = renderToStaticMarkup(<Component />);
      expect(html, `${name} masih pakai spinner`).not.toContain("animate-spin");
      // Teks untuk pembaca layar boleh tetap ada (`sr-only`, `aria-label`),
      // tapi tidak boleh ada teks "memuat" yang terlihat - bentuknya harus
      // skeleton.
      const visible = html
        .replace(/<span class="sr-only">[\s\S]*?<\/span>/g, "")
        .replace(/aria-label="[^"]*"/g, "");
      expect(visible, `${name} masih pakai teks memuat`).not.toMatch(
        /Memuat halaman|Memuat data/i,
      );
    }
  });
});
