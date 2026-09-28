import { describe, expect, it } from "vitest";
import {
  buildLaporanShift,
  formatShiftAsText,
  formatShiftRowsForSheet,
  rupiah,
  type ShiftCashRow,
  type ShiftSaleRow,
  type ShiftServiceRow,
  type ShiftSession,
} from "./laporan-shift";

const OPEN = "2026-09-28T08:00:00.000Z";
const CLOSE = "2026-09-28T17:30:00.000Z";
const NOW = new Date("2026-09-28T17:45:00.000Z");

function session(overrides: Partial<ShiftSession> = {}): ShiftSession {
  return {
    id: "s-1",
    branchId: "b1",
    employeeId: "e1",
    openAt: OPEN,
    openingBalance: 250_000,
    closedAt: null,
    closingBalance: null,
    variance: null,
    branchName: "Cabang Pusat",
    employeeName: "Rina",
    ...overrides,
  };
}

function svc(overrides: Partial<ShiftServiceRow> = {}): ShiftServiceRow {
  return {
    id: "sv1",
    service_number: "SRV-001",
    device: "iPhone 11",
    status: "Selesai",
    price: 100_000,
    created_at: "2026-09-28T09:00:00.000Z",
    updated_at: "2026-09-28T12:00:00.000Z",
    ...overrides,
  };
}

function sale(overrides: Partial<ShiftSaleRow> = {}): ShiftSaleRow {
  return {
    id: "sl1",
    sale_number: "SAL-001",
    total: 100_000,
    paid: 100_000,
    payment_status: "lunas",
    payment_method: "Tunai",
    kas_date: "2026-09-28",
    servis_id: null,
    ...overrides,
  };
}

function cash(overrides: Partial<ShiftCashRow> = {}): ShiftCashRow {
  return {
    id: "c1",
    type: "pemasukan",
    amount: 50_000,
    description: "Setoran owner",
    kas_date: "2026-09-28",
    source: "kas_manual",
    ...overrides,
  };
}

function build(overrides: Partial<Parameters<typeof buildLaporanShift>[0]> = {}) {
  return buildLaporanShift({
    session: session(),
    services: [],
    sales: [],
    cashTx: [],
    now: NOW,
    ...overrides,
  });
}

describe("rekap", () => {
  it("expected = opening + servis lunas + penjualan lunas + kas masuk - kas keluar", () => {
    const report = build({
      services: [svc({ price: 100_000 })],
      sales: [sale({ total: 50_000, servis_id: null })],
      cashTx: [
        cash({ type: "pemasukan", amount: 30_000 }),
        cash({ id: "c2", type: "pengeluaran", amount: 20_000 }),
      ],
    });
    // 250_000 + 100_000 + 50_000 + 30_000 - 20_000
    expect(report.totals.expected).toBe(410_000);
    expect(report.totals.manualNet).toBe(10_000);
  });

  it("sesi kosong tetap menghasilkan expected = opening", () => {
    const report = build();
    expect(report.totals.expected).toBe(250_000);
    expect(report.services).toEqual([]);
    expect(report.sales).toEqual([]);
    expect(report.cashTx).toEqual([]);
  });

  it("hanya Selesai dan Sudah Diambil yang menambah kas", () => {
    const report = build({
      services: [
        svc({ id: "a", status: "Selesai", price: 10_000 }),
        svc({ id: "b", status: "Sudah Diambil", price: 20_000 }),
        svc({ id: "c", status: "Batal", price: 30_000 }),
        svc({ id: "d", status: "Dikerjakan", price: 40_000 }),
        svc({ id: "e", status: "Masuk", price: 50_000 }),
      ],
    });
    expect(report.totals.services).toBe(30_000);
  });

  it("penjualan belum lunas tampil di daftar tapi tidak menambah saldo", () => {
    const report = build({ sales: [sale({ total: 90_000, payment_status: "belum_bayar" })] });
    expect(report.sales).toHaveLength(1);
    expect(report.sales[0].settled).toBe(false);
    expect(report.totals.sales).toBe(0);
    expect(report.totals.expected).toBe(250_000);
  });

  it("payment_status selain 'lunas' diperlakukan sebagai belum masuk", () => {
    const report = build({
      sales: [sale({ payment_status: "LUNAS" }), sale({ id: "s2", payment_status: "" })],
    });
    expect(report.totals.sales).toBe(0);
  });

  it("hanya kas_manual dan penyesuaian yang masuk rekap kas", () => {
    const report = build({
      cashTx: [
        cash({ id: "a", amount: 10_000 }),
        cash({ id: "b", amount: 20_000, source: "penyesuaian" }),
        cash({ id: "c", amount: 999_000, source: "transaksi" }),
      ],
    });
    expect(report.cashTx.map((line) => line.id)).toEqual(["a", "b"]);
    expect(report.totals.manualIn).toBe(30_000);
  });

  it("keterangan kosong mendapat label sesuai arahnya", () => {
    const report = build({
      cashTx: [cash({ id: "a", description: null }), cash({ id: "b", type: "pengeluaran", description: "  " })],
    });
    expect(report.cashTx[0].label).toBe("Pemasukan");
    expect(report.cashTx[1].label).toBe("Pengeluaran");
  });
});

describe("anti double counting lewat servis_id", () => {
  it("servis yang punya penjualan terkait tidak dihitung lewat price-nya", () => {
    const report = build({
      services: [svc({ id: "sv1", price: 100_000 })],
      sales: [sale({ servis_id: "sv1", total: 100_000 })],
    });
    // price servis 100_000 TIDAK ikut, penjualan 100_000 yang dihitung.
    expect(report.totals.services).toBe(0);
    expect(report.totals.sales).toBe(100_000);
    expect(report.totals.expected).toBe(350_000);
    expect(report.services[0].counted).toBe(false);
  });

  it("penjualan yang menunjuk servis itu tetap dihitung normal", () => {
    const report = build({
      services: [svc({ id: "sv1", price: 100_000 })],
      sales: [sale({ servis_id: "sv1", total: 100_000 })],
    });
    expect(report.sales).toHaveLength(1);
    expect(report.sales[0].forService).toBe("sv1");
  });

  it("penjualan barang tanpa pengait dihitung normal", () => {
    const report = build({ sales: [sale({ servis_id: null, total: 75_000 })] });
    expect(report.totals.sales).toBe(75_000);
  });

  it("beberapa penjualan untuk satu servis tetap menandainya satu kali", () => {
    const report = build({
      services: [svc({ id: "sv1", price: 100_000 })],
      sales: [
        sale({ id: "a", servis_id: "sv1", total: 60_000 }),
        sale({ id: "b", servis_id: "sv1", total: 40_000 }),
      ],
    });
    expect(report.totals.services).toBe(0);
    expect(report.totals.sales).toBe(100_000);
  });

  it("servis selesai yang belum dibayar tidak muncul di expected", () => {
    // Konsekuensi yang disadari: cervise_services tidak punya kolom
    // pembayaran, jadi tidak ada cara menghitung servis yang dikerjakan tapi
    // belum dibayar.
    const report = build({ services: [svc({ status: "Selesai", price: 80_000 })] });
    expect(report.totals.services).toBe(80_000);
    expect(report.totals.expected).toBe(330_000);
  });
});

describe("jendela waktu servis", () => {
  it("servis sebelum jam buka tidak masuk", () => {
    const report = build({ services: [svc({ created_at: "2026-09-28T07:59:59.000Z" })] });
    expect(report.services).toHaveLength(0);
  });

  it("servis tepat di jam buka masuk", () => {
    const report = build({ services: [svc({ created_at: OPEN })] });
    expect(report.services).toHaveLength(1);
  });

  it("servis tepat di jam tutup TIDAK masuk (batas atas eksklusif)", () => {
    const report = build({
      session: session({ closedAt: CLOSE }),
      services: [svc({ created_at: CLOSE })],
    });
    expect(report.services).toHaveLength(0);
  });

  it("sesi terbuka memakai now sebagai batas atas", () => {
    const before = build({ services: [svc({ created_at: "2026-09-28T17:44:00.000Z" })] });
    expect(before.services).toHaveLength(1);
    const after = build({ services: [svc({ created_at: "2026-09-28T17:50:00.000Z" })] });
    expect(after.services).toHaveLength(0);
  });

  it("tidak memotong penjualan dan kas manual oleh jam", () => {
    // kas_date hanya menyimpan tanggal, jadi keduanya mencakup seluruh hari.
    const report = build({
      sales: [sale({ kas_date: "2026-09-28" })],
      cashTx: [cash({ kas_date: "2026-09-28" })],
    });
    expect(report.sales).toHaveLength(1);
    expect(report.cashTx).toHaveLength(1);
  });
});

describe("variance", () => {
  it("null selama sesi masih terbuka", () => {
    const report = build();
    expect(report.variance).toBeNull();
    expect(report.closingBalance).toBeNull();
  });

  it("nol saat saldo fisik sama dengan expected", () => {
    const report = build({ session: session({ closingBalance: 250_000, closedAt: CLOSE }) });
    expect(report.totals.expected).toBe(250_000);
    expect(report.variance).toBe(0);
  });

  it("negatif berarti kurang", () => {
    const report = build({ session: session({ closingBalance: 248_500, closedAt: CLOSE }) });
    expect(report.variance).toBe(-1_500);
  });

  it("positif berarti lebih", () => {
    const report = build({ session: session({ closingBalance: 252_000, closedAt: CLOSE }) });
    expect(report.variance).toBe(2_000);
  });
});

describe("report sebagai snapshot", () => {
  it("memuat identitas shift untuk disimpan ke jsonb", () => {
    const report = build();
    expect(report.schemaVersion).toBe(1);
    expect(report.branchName).toBe("Cabang Pusat");
    expect(report.employeeName).toBe("Rina");
    expect(report.date).toBe("2026-09-28");
    expect(report.openAt).toBe(OPEN);
  });

  it("snapshot bisa diserialisasi tanpa kehilangan data", () => {
    const report = build({
      services: [svc()],
      sales: [sale()],
      cashTx: [cash()],
    });
    const round = JSON.parse(JSON.stringify(report));
    expect(round).toEqual(report);
  });

  it("closingAt untuk sesi terbuka diisi dengan now", () => {
    const report = build();
    expect(report.closingAt).toBe(NOW.toISOString());
  });
});

describe("formatShiftAsText", () => {
  it("memuat seluruh nominal rekap", () => {
    const text = formatShiftAsText(
      build({
        services: [svc({ price: 100_000 })],
        sales: [sale({ total: 50_000 })],
        cashTx: [cash({ amount: 25_000 }), cash({ id: "c2", type: "pengeluaran", amount: 5_000 })],
        session: session({ closingBalance: 250_000, closedAt: CLOSE }),
      }),
    );
    expect(text).toContain("LAPORAN SHIFT");
    expect(text).toContain("Cabang Pusat");
    expect(text).toContain("Rina");
    expect(text).toContain(rupiah(250_000));
    expect(text).toContain(rupiah(100_000));
    expect(text).toContain(rupiah(50_000));
    expect(text).toContain(rupiah(25_000));
    expect(text).toContain(rupiah(5_000));
  });

  it("menandai penjualan belum lunas", () => {
    const text = formatShiftAsText(build({ sales: [sale({ payment_status: "belum_bayar" })] }));
    expect(text).toContain("BELUM BAYAR");
  });

  it("menandai servis yang sudah lewat penjualan", () => {
    const text = formatShiftAsText(
      build({ services: [svc({ id: "sv1" })], sales: [sale({ servis_id: "sv1" })] }),
    );
    expect(text).toContain("[sudah lewat penjualan]");
  });

  it("menyatakan kas manual kosong secara eksplisit", () => {
    expect(formatShiftAsText(build())).toContain("(tidak ada)");
  });

  it("menyatakan kurang dan lebih untuk selisih", () => {
    const kurang = formatShiftAsText(
      build({ session: session({ closingBalance: 248_500, closedAt: CLOSE }) }),
    );
    expect(kurang).toContain("Kurang");

    const lebih = formatShiftAsText(
      build({ session: session({ closingBalance: 251_000, closedAt: CLOSE }) }),
    );
    expect(lebih).toContain("Lebih");
  });

  it("menyatakan Saldo sesuai saat selisih nol", () => {
    const text = formatShiftAsText(
      build({ session: session({ closingBalance: 250_000, closedAt: CLOSE }) }),
    );
    expect(text).toContain("Selisih");
    expect(text).not.toContain("Kurang");
    expect(text).not.toContain("Lebih");
  });

  it("tidak menyebut saldo akhir saat sesi masih terbuka", () => {
    const text = formatShiftAsText(build());
    expect(text).not.toContain("Saldo akhir fisik");
  });
});

describe("formatShiftRowsForSheet", () => {
  it("menghasilkan baris yang memuat seluruh nominal", () => {
    const rows = formatShiftRowsForSheet(
      build({
        services: [svc({ price: 100_000 })],
        sales: [sale({ total: 50_000 })],
        cashTx: [cash({ amount: 25_000 })],
      }),
    );
    const flat = rows.flat();
    expect(flat).toContain("LAPORAN SHIFT");
    expect(flat).toContain(250_000);
    expect(flat).toContain(100_000);
    expect(flat).toContain(50_000);
    expect(flat).toContain(25_000);
  });

  it("jumlah baris accommodates item + header + rekap", () => {
    const withItems = formatShiftRowsForSheet(
      build({
        services: [svc({ id: "a" }), svc({ id: "b" })],
        sales: [sale({ id: "c" })],
        cashTx: [cash({ id: "d" }), cash({ id: "e" })],
      }),
    );
    // 2 servis + 1 penjualan + 2 kas = 5 baris item, plus blok & rekap.
    expect(withItems.length).toBeGreaterThan(15);
  });

  it("kolom 'Dihitung' menandai servis yang lewat penjualan", () => {
    const rows = formatShiftRowsForSheet(
      build({ services: [svc({ id: "sv1" })], sales: [sale({ servis_id: "sv1" })] }),
    );
    expect(rows.flat()).toContain("lewat penjualan");
  });

  it("semua sel primitif, tanpa objek", () => {
    const rows = formatShiftRowsForSheet(build({ services: [svc()], sales: [sale()] }));
    for (const row of rows) {
      for (const cell of row) {
        expect(["string", "number"]).toContain(typeof cell);
      }
    }
  });
});

describe("rupiah", () => {
  it("memakai format Rupiah tanpa desimal", () => {
    expect(rupiah(250_000)).toContain("250.000");
    expect(rupiah(0)).toContain("0");
  });

  it("nilai tidak valid menjadi 0", () => {
    expect(rupiah(Number.NaN)).toContain("0");
  });
});
