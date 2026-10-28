import { describe, expect, it } from "vitest";
import { renderShiftThermalHtml } from "./shift-thermal-print";
import type { ShiftReport } from "@/lib/operational/laporan-shift";

/**
 * Laporan shift lengkap dengan angka yang sengaja berbeda satu sama lain.
 *
 * Kalau semua total bernilai sama, test yang salah masih bisa lolos. Di sini
 * setiap sumber kas punya nilai sendiri supaya isi struk bisa dibedakan.
 */
function report(overrides: Partial<ShiftReport> = {}): ShiftReport {
  return {
    schemaVersion: 1,
    branchName: "Cabang Pusat Bandung",
    employeeName: "Rina",
    date: "2026-09-18",
    openAt: "2026-09-18T03:00:00.000Z", // 10:00 WIB
    closingAt: "2026-09-18T16:59:00.000Z", // 23:59 WIB
    openingBalance: 500_000,
    closingBalance: 1_275_000,
    expectedCash: 1_300_000,
    variance: -25_000,
    reason: "Kembalian 25.000 tidak sempat dicatat",
    services: [
      {
        id: "s1",
        label: "iPhone 13",
        status: "Selesai",
        amount: 600_000,
        counted: true,
        updatedAt: "2026-09-18T09:00:00.000Z",
      },
      {
        id: "s2",
        label: "Redmi Note 11",
        status: "Selesai",
        amount: 350_000,
        counted: true,
        updatedAt: "2026-09-18T10:00:00.000Z",
      },
    ],
    sales: [
      {
        id: "x1",
        label: "SAL-0001",
        amount: 150_000,
        paid: 150_000,
        method: "Tunai",
        settled: true,
        forService: null,
      },
    ],
    cashTx: [{ id: "c1", direction: "pemasukan", label: "Kas manual masuk", amount: 100_000, source: "kas_manual", metode: null }],
    totals: {
      services: 950_000,
      sales: 150_000,
      manualIn: 100_000,
      manualOut: 0,
      manualNet: 100_000,
      expected: 1_300_000,
    },
    ...overrides,
  };
}

describe("renderShiftThermalHtml", () => {
  it("cetak pada kertas thermal 58mm", () => {
    // Struk thermal butuh @page 58mm; tanpa itu printer memakai A4 dan
    // struknya menyusut ke pojok kertas.
    const html = renderShiftThermalHtml(report());
    expect(html).toContain("size: 58mm auto");
    expect(html).toContain("width:58mm");
  });

  it("memakai family font dan pemisah yang sama dengan struk nota servis", () => {
    const html = renderShiftThermalHtml(report());
    expect(html).toContain("Courier New");
    expect(html).toContain("border-top:1px dashed #000");
  });

  it("menuliskan identitas shift", () => {
    const html = renderShiftThermalHtml(report());
    expect(html).toContain("RINGKASAN SHIFT");
    expect(html).toContain("Cabang Pusat Bandung");
    expect(html).toContain("Rina");
    expect(html).toContain("2026-09-18");
  });

  it("menampilkan jam buka dan jam tutup, bukan string ISO mentah", () => {
    // open_at disimpan sebagai timestamptz UTC. Dicetak mentah, struk akan
    // memuat "2026-09-18T03:00:00.000Z" - panjang dan tidak terbaca di kasir.
    const html = renderShiftThermalHtml(report());
    expect(html).toContain("Open Shift");
    expect(html).toContain("10:00");
    expect(html).toContain("Close Shift");
    expect(html).toContain("23:59");
    expect(html).not.toContain("2026-09-18T03:00:00.000Z");
    expect(html).not.toContain("T16:59:00");
  });

  it("mencetak siapa yang membuka dan menutup, plus durasi shift", () => {
    const html = renderShiftThermalHtml(
      report({ closedByName: "Budi", durationMinutes: 839 }),
    );
    expect(html).toContain("Open By");
    expect(html).toContain("Rina");
    expect(html).toContain("Close By");
    expect(html).toContain("Budi");
    expect(html).toContain("Total Duration");
    expect(html).toContain("13j 59m");
    // Snapshot lama belum punya nama penutup: jangan cetak "null".
    expect(renderShiftThermalHtml(report())).not.toContain("undefined");
  });

  it("mengelompokkan sparepart dan hitungan status servis", () => {
    const html = renderShiftThermalHtml(
      report({
        spareparts: [
          { name: "LCD iPhone 13", qty: 1 },
          { name: "Baterai", qty: 2 },
        ],
        serviceStats: { masuk: 4, selesai: 2, diambil: 1, batal: 1 },
      }),
    );
    expect(html).toContain("Sparepart terpakai");
    expect(html).toContain("LCD iPhone 13");
    expect(html).toContain("x2");
    expect(html).toContain("Servis Masuk");
    expect(html).toContain("Servis Selesai");
    expect(html).toContain("Diambil");
    expect(html).toContain("Batal");
  });

  it("memuat seluruh angka kas ringkasan", () => {
    const html = renderShiftThermalHtml(report());
    // Saldo awal, omzet servis, omzet penjualan, kas manual, harus ada,
    // saldo akhir, dan selisih - semuanya harus ada, tidak boleh ada yang
    // hilang karena tidak sengaja.
    expect(html).toContain("Saldo awal");
    expect(html).toContain("Harus ada");
    expect(html).toContain("Saldo akhir");
    expect(html).toContain("Selisih");
    // Angka dikirim lewat `rupiah()`, jadi bentuknya "Rp 500.000" dengan
    // tanda minus menyatu di depan "Rp" untuk yang negatif.
    expect(html).toContain("Rp\u00a0500.000");
    expect(html).toContain("Rp\u00a0950.000");
    expect(html).toContain("Rp\u00a0150.000");
    expect(html).toContain("Rp\u00a01.300.000");
    expect(html).toContain("Rp\u00a01.275.000");
    expect(html).toContain("-Rp\u00a025.000");
  });

  it("menampilkan jumlah baris servis dan penjualan", () => {
    const html = renderShiftThermalHtml(report());
    expect(html).toContain("Servis (2)");
    expect(html).toContain("Penjualan (1)");
  });

  it("mempertahankan arah kas manual di struk", () => {
    // Tanda diambil dari `rupiah()` supaya bentuknya sama dengan baris
    // Selisih. Menambahkan "+"/"-" sendiri menghasilkan "+ Rp 100.000" di satu
    // baris dan "-Rp 40.000" di baris lain - dua bentuk tanda dalam satu struk.
    const masuk = renderShiftThermalHtml(report());
    expect(masuk).toContain("Rp\u00a0100.000");
    expect(masuk).not.toContain("+ Rp");

    const keluar = renderShiftThermalHtml(
      report({ totals: { ...report().totals, manualNet: -40_000 } }),
    );
    expect(keluar).toContain("-Rp\u00a040.000");
  });

  it("menuliskan alasan selisih saat ada", () => {
    expect(renderShiftThermalHtml(report())).toContain("Kembalian 25.000 tidak sempat dicatat");
  });

  it("menghilangkan blok alasan saat tidak ada", () => {
    const html = renderShiftThermalHtml(report({ reason: null }));
    expect(html).not.toContain("Catatan");
  });

  it("tetap mencetak nilai yang belum terisi sebagai —", () => {
    // balancing dihitung ulang tepat sebelum submit, tapi bila alurnya
    // berubah atau struk dicetak ulang dari snapshot yang belum lengkap,
    // struk tidak boleh berlubang atauprinting "null".
    const html = renderShiftThermalHtml(
      report({ closingBalance: null, variance: null, expectedCash: 0, reason: null }),
    );
    expect(html).toContain("—");
    expect(html).not.toContain("null");
    expect(html).not.toContain("NaN");
  });

  it("meloloskan nilai yang mengandung HTML apa adanya", () => {
    // `reason` ditulis manual oleh frontliner; `employeeName` bisa berisi
    // tanda baca. Tanpa escaping, satu `<` membatalkan seluruh markup.
    const html = renderShiftThermalHtml(
      report({
        reason: "<script>alert('x')</script>",
        employeeName: 'Rina "Kasir" <b>',
        branchName: "Cabang &.store",
      }),
    );
    // Yang diuji escaping-nya bukan substring "alert(" - teks itu boleh muncul
    // sebagai isi yang sudah ter-escape. Yang tidak boleh lolos adalah tag
    // `<script>` yang utuh, karena itu yang bisa dieksekusi.
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;.store");
    expect(html).toContain("&quot;Kasir&quot;");
    expect(html).toContain("&lt;b&gt;");
  });

  it("tidak membuka dialog cetak sendiri", () => {
    // Cetak ditangani pemanggil lewat `printShiftThermal`. Kalau template ikut
    // memanggil `window.print()`, struk akan tercetak dua kali saat dialog
    // Tutup Toko dibuka dari preview.
    expect(renderShiftThermalHtml(report())).not.toContain("window.print()");
  });

  it("tidak membocorkan detail baris servis ke struk ringkasan", () => {
    // Struk thermal sempit. Rincian per servis dan per penjualan ada di
    // Laporan Shift; memaksanya ke sini membuat struk jadi beberapa halaman.
    const html = renderShiftThermalHtml(report());
    expect(html).not.toContain("iPhone 13");
    expect(html).not.toContain("Redmi Note 11");
    expect(html).not.toContain("SAL-0001");
  });
});