/**
 * Laporan Shift: gabungan Laporan Servis, Laporan Penjualan, dan kas manual
 * untuk satu hari shift.
 *
 * Modul ini murni. Tidak menyentuh database dan tidak membaca jam sistem —
 * `now` selalu parameter supaya hasilnya deterministik dan bisa diuji. Pola
 * yang sama dipakai `laporan-servis.ts` dan `laporan-penjualan.ts`.
 *
 * Bentuk masukan disengaja datar: array hasil query, bukan objek berisi query.
 */

import { kalenderWIB } from "./periode-bulan";

export const SHIFT_SNAPSHOT_VERSION = 1;

/** Status servis yang dianggap sudah dikerjakan. Sama dengan `DONE` di laporan-servis.ts. */
const DONE_STATUS = new Set(["Selesai", "Sudah Diambil"]);

export type ShiftSession = {
  id: string;
  branchId: string;
  employeeId: string;
  openAt: string;
  openingBalance: number;
  closedAt: string | null;
  closingBalance: number | null;
  variance: number | null;
  branchName: string;
  employeeName: string;
};

export type ShiftServiceRow = {
  id: string;
  service_number: string | null;
  device: string | null;
  status: string;
  price: number | null;
  created_at: string;
  updated_at: string;
};

/** Baris penjualan. `servis_id` null = penjualan barang, bukan pembayaran servis. */
export type ShiftSaleRow = {
  id: string;
  sale_number: string | null;
  total: number | null;
  paid: number | null;
  payment_status: string;
  payment_method: string | null;
  kas_date: string;
  servis_id: string | null;
};

export type ShiftCashRow = {
  id: string;
  type: "pemasukan" | "pengeluaran";
  amount: number;
  description: string | null;
  kas_date: string;
  source: string;
};

export type ShiftServiceLine = {
  id: string;
  label: string;
  status: string;
  amount: number;
  /** true kalau baris ini sudah punya penjualan terkait, jadi tidak dihitung lagi. */
  counted: boolean;
  /**
   * Kapan baris terakhir berubah. Dibawa ke sini supaya kartu "Transaksi
   * Terbaru" bisa menampilkan tanggal tanpa query tambahan.
   */
  updatedAt: string;
};

export type ShiftSaleLine = {
  id: string;
  label: string;
  /** Nilai jual penuh. Ini pendapatan, bukan uang di laci. */
  amount: number;
  /** Uang yang benar-benar diterima. Untuk DP ini lebih kecil dari `amount`. */
  paid: number;
  settled: boolean;
  method: string | null;
  forService: string | null;
};

export type ShiftCashLine = {
  id: string;
  direction: "pemasukan" | "pengeluaran";
  label: string;
  amount: number;
};

export type ShiftTotals = {
  services: number;
  sales: number;
  manualIn: number;
  manualOut: number;
  manualNet: number;
  expected: number;
};

export type ShiftReport = {
  schemaVersion: number;
  branchName: string;
  employeeName: string;
  date: string;
  openAt: string;
  closingAt: string;
  openingBalance: number;
  closingBalance: number | null;
  expectedCash: number;
  variance: number | null;
  reason: string | null;
  services: ShiftServiceLine[];
  sales: ShiftSaleLine[];
  cashTx: ShiftCashLine[];
  totals: ShiftTotals;
};

function amount(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * `payment_status` tidak punya CHECK constraint nilainya, jadi filter di sini
 * ditulis eksplisit: apa pun selain `lunas` dan `dp` diperlakukan sebagai belum
 * masuk, bukan diabaikan diam-diam.
 *
 * `dp` ikut dihitung karena uangnya benar-benar ada di laci. Kalau hanya
 * `lunas` yang dihitung, setiap pembayaran cicilan hilang dari "Harus ada di
 * laci" padahal kasir sudah menerimanya.
 */
function isSettled(status: string | null | undefined): boolean {
  return status === "lunas" || status === "dp";
}

/** Tanggal kalender shift, dari `open_at`. */
function shiftDate(session: ShiftSession, now: Date): string {
  const opened = new Date(session.openAt);
  const base = Number.isNaN(opened.getTime()) ? now : opened;
  // Hari UTC akan menaruh shift yang dibuka jam 00:00-07:00 WIB di tanggal
  // sebelumnya, jadi shift itu terpotong oleh hari yang salah di laporan.
  return kalenderWIB(base);
}

function serviceLabel(row: ShiftServiceRow): string {
  const number = row.service_number ?? "—";
  return `${number} · ${row.device ?? "Tanpa perangkat"}`;
}

function saleLabel(row: ShiftSaleRow): string {
  return row.sale_number ?? "Penjualan tanpa nomor";
}

function cashLabel(row: ShiftCashRow): string {
  return row.description?.trim() || (row.type === "pemasukan" ? "Pemasukan" : "Pengeluaran");
}

/**
 * Bangun laporan untuk satu sesi.
 *
 * **Aturan anti double counting.** `cervise_services` tidak punya kolom
 * pembayaran, jadi tidak ada cara tahu apakah servis sudah dibayar. Yang bisa
 * dipakai adalah `cervise_sales.servis_id`: kalau ada penjualan yang menunjuk
 * servis itu, servicedenya sudah terhitung lewat penjualan dan `price`-nya
 * tidak boleh dihitung lagi. Baris penjualan itu sendiri tetap dihitung
 * normal.
 *
 * Konsekuensinya, servis yang dikerjakan tapi belum dibayar **tidak muncul
 * sama sekali** di rekap. Itu konsekuensi yang disadari dari tidak adanya
 * kolom pembayaran, bukan kelalaian.
 */
export function buildLaporanShift(input: {
  session: ShiftSession;
  services: ShiftServiceRow[];
  sales: ShiftSaleRow[];
  cashTx: ShiftCashRow[];
  now: Date;
}): ShiftReport {
  const { session, services, sales, cashTx, now } = input;

  // Pengait servis -> penjualan. Satu servis bisa punya beberapa penjualan
  // (misal DP lalu pelunasan); satu saja sudah cukup untuk menandainya lunas.
  const soldServiceIds = new Set(
    sales.filter((sale) => sale.servis_id !== null).map((sale) => sale.servis_id as string),
  );

  // Servis dipotong tepat pada jam buka/tutup: created_at bertipe timestamptz
  // (`20260925130000:41`) sehingga jamnya tersimpan. Penjualan dan kas manual
  // tidak bisa — kas_date bertipe date dan jamnya hilang, jadi keduanya
  // mencakup seluruh transaksi kalender hari itu.
  const openMs = new Date(session.openAt).getTime();
  const closeAt = session.closedAt ? new Date(session.closedAt).toISOString() : now.toISOString();
  const closeMs = new Date(closeAt).getTime();
  const hasValidWindow = !Number.isNaN(openMs) && !Number.isNaN(closeMs);

  const serviceLines: ShiftServiceLine[] = services
    .filter((row) => {
      if (!hasValidWindow) return true;
      const created = new Date(row.created_at).getTime();
      // Batas atas `<`, bukan `<=`, supaya servis yang tercatat tepat di detik
      // penutupan tidak terhitung dua kali bila closed_at diisi ulang.
      return created >= openMs && created < closeMs;
    })
    .map((row) => ({
      id: row.id,
      label: serviceLabel(row),
      status: row.status,
      amount: amount(row.price),
      counted: !soldServiceIds.has(row.id),
      updatedAt: row.updated_at,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const saleLines: ShiftSaleLine[] = sales
    .map((row) => ({
      id: row.id,
      label: saleLabel(row),
      amount: amount(row.total),
      paid: amount(row.paid),
      settled: isSettled(row.payment_status),
      method: row.payment_method,
      forService: row.servis_id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const cashLines: ShiftCashLine[] = cashTx
    .filter((row) => row.source === "kas_manual" || row.source === "penyesuaian")
    .map((row) => ({
      id: row.id,
      direction: row.type,
      label: cashLabel(row),
      amount: amount(row.amount),
    }))
    .sort((a, b) => a.direction.localeCompare(b.direction) || a.label.localeCompare(b.label));

  // Hanya servis Selesai/Sudah Diambil yang menambah kas, dan hanya kalau
  // belum ada penjualan yang menunjuknya.
  const servicesTotal = serviceLines
    .filter((line) => line.counted && DONE_STATUS.has(line.status))
    .reduce((sum, line) => sum + line.amount, 0);

  const salesTotal = saleLines
    .filter((line) => line.settled)
    .reduce((sum, line) => sum + line.amount, 0);

  // Uang FISIK di laci. Berbeda dari pendapatan di atas:
  //   - hanya metode Tunai. QRIS, Debit, Transfer, dan E-Wallet masuk ke
  //     rekening atau kartu, bukan ke laci, tapi sebelumnya ikut dijumlahkan.
  //   - memakai `paid`, bukan `total`. Pembayaran DP storing total penuh
  //     padahal kasir hanya menerima sebagian.
  const cashSalesTotal = saleLines
    .filter((line) => line.settled && line.method === "Tunai")
    .reduce((sum, line) => sum + line.paid, 0);

  const manualIn = cashLines
    .filter((line) => line.direction === "pemasukan")
    .reduce((sum, line) => sum + line.amount, 0);
  const manualOut = cashLines
    .filter((line) => line.direction === "pengeluaran")
    .reduce((sum, line) => sum + line.amount, 0);

  // Pendapatan: semua penjualan yang sudah dibayar apa pun metodenya, plus
  // servis selesai yang belum punya penjualan. Ini yang dipakai untuk omzet.
  const expected =
    amount(session.openingBalance) + servicesTotal + salesTotal + manualIn - manualOut;

  // Uang di laci. Perbedaannya dari `expected` hanya pada penjualan: yang di
  // sini hanya metode Tunai dan memakai `paid`, bukan `total`.
  //
  // Suku servis SENGAJA belum dipisah. `servicesTotal` mencampur dua hal:
  // `cervise_services.price` ditimpa jadi jumlah pembayaran oleh
  // `addPembayaran` (servis/actions.ts), tapi servis yang belum dibayar pun
  // tetap punya harga penawaran. Dipisah secara benar butuh memisahkan juga
  // dua jalur pembayaran servis - `payServis` menulis ke cervise_sales dengan
  // metode, `addPembayaran` menulis ke finance_tx - dan itu belum ada
  // bedanya di baris laporan. Sampai itu ada, kas undercount hanya untuk
  // non-Tunai yang bisa dibuktikan.
  const expectedCash =
    amount(session.openingBalance) + cashSalesTotal + servicesTotal + manualIn - manualOut;

  return {
    schemaVersion: SHIFT_SNAPSHOT_VERSION,
    branchName: session.branchName,
    employeeName: session.employeeName,
    date: shiftDate(session, now),
    openAt: session.openAt,
    closingAt: closeAt,
    openingBalance: amount(session.openingBalance),
    closingBalance: session.closingBalance === null ? null : amount(session.closingBalance),
    expectedCash: expectedCash,
    variance:
      session.closingBalance === null ? null : amount(session.closingBalance) - expectedCash,
    reason: null,
    services: serviceLines,
    sales: saleLines,
    cashTx: cashLines,
    totals: {
      services: servicesTotal,
      sales: salesTotal,
      manualIn,
      manualOut,
      manualNet: manualIn - manualOut,
      expected,
    },
  };
}

// ---------------------------------------------------------------------------
// Format teks
// ---------------------------------------------------------------------------

const RUPIAH = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function rupiah(value: number): string {
  return RUPIAH.format(amount(value));
}

/**
 * Versi plain text untuk "copy as text". Semua nominal ikut ditulis supaya
 * angka bisa diperiksa tanpa membuka aplikasi.
 */
export function formatShiftAsText(report: ShiftReport): string {
  const lines: string[] = [];
  const rule = "-".repeat(46);

  lines.push("LAPORAN SHIFT");
  lines.push(`Toko: ${report.branchName}`);
  lines.push(`Frontliner: ${report.employeeName}`);
  lines.push(`Shift: ${report.date}`);
  lines.push(`Jam: ${report.openAt} - ${report.closingAt}`);
  lines.push("");

  lines.push("SALDO AWAL");
  lines.push(`${rule}`);
  lines.push(`Saldo awal${" ".repeat(28)}${rupiah(report.openingBalance)}`);
  lines.push("");

  lines.push(`LAYANAN SERVIS (${report.services.length})`);
  lines.push(rule);
  for (const line of report.services) {
    const marker = line.counted ? "" : "  [sudah lewat penjualan]";
    lines.push(`${line.label}${marker}`);
    lines.push(`  ${line.status}${" ".repeat(24)}${rupiah(line.amount)}`);
  }
  lines.push("");

  lines.push(`PENJUALAN (${report.sales.length})`);
  lines.push(rule);
  for (const line of report.sales) {
    const status = line.settled ? "lunas" : "BELUM BAYAR";
    const method = line.method ? ` · ${line.method}` : "";
    lines.push(`${line.label}${method}`);
    lines.push(`  ${status}${" ".repeat(22)}${rupiah(line.amount)}`);
  }
  lines.push("");

  lines.push(`TRANSAKSI KAS MANUAL (${report.cashTx.length})`);
  lines.push(rule);
  if (report.cashTx.length === 0) {
    lines.push("(tidak ada)");
  } else {
    for (const line of report.cashTx) {
      const sign = line.direction === "pemasukan" ? "+" : "-";
      lines.push(`${sign} ${line.label}`);
      lines.push(`  ${" ".repeat(28)}${rupiah(line.amount)}`);
    }
  }
  lines.push("");

  lines.push("REKAP");
  lines.push(rule);
  lines.push(`Omzet servis${" ".repeat(27)}${rupiah(report.totals.services)}`);
  lines.push(`Omzet penjualan${" ".repeat(24)}${rupiah(report.totals.sales)}`);
  lines.push(
    `Transaksi manual${" ".repeat(21)}${rupiah(report.totals.manualNet)}`,
  );
  lines.push("-".repeat(46));
  lines.push(`Harus ada di laci${" ".repeat(20)}${rupiah(report.expectedCash)}`);
  if (report.closingBalance !== null) {
    lines.push(`Saldo akhir fisik${" ".repeat(19)}${rupiah(report.closingBalance)}`);
    const variance = amount(report.variance);
    const label = variance === 0 ? "Selisih" : variance < 0 ? "Kurang" : "Lebih";
    lines.push(`${label}${" ".repeat(31 - label.length)}${rupiah(Math.abs(variance))}`);
    if (report.reason) lines.push(`Alasan: ${report.reason}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Format lembar kerja
// ---------------------------------------------------------------------------

/**
 * Baris untuk XLSX, sebagai array-of-array. `XLSX.utils.aoa_to_sheet` menerimanya
 * apa adanya, jadi tidak perlu pemetaan per sel di luar file ini.
 */
export function formatShiftRowsForSheet(report: ShiftReport): (string | number)[][] {
  const rows: (string | number)[][] = [];

  rows.push(["LAPORAN SHIFT"]);
  rows.push(["Toko", report.branchName]);
  rows.push(["Frontliner", report.employeeName]);
  rows.push(["Shift", report.date]);
  rows.push(["Jam", `${report.openAt} - ${report.closingAt}`]);
  rows.push([]);

  rows.push(["SALDO AWAL"]);
  rows.push(["Saldo awal", report.openingBalance]);

  rows.push([]);
  rows.push(["LAYANAN SERVIS"]);
  rows.push(["Servis", "Status", "Nominal", "Dihitung"]);
  for (const line of report.services) {
    rows.push([line.label, line.status, line.amount, line.counted ? "ya" : "lewat penjualan"]);
  }
  rows.push(["Total servis", "", report.totals.services]);

  rows.push([]);
  rows.push(["PENJUALAN"]);
  rows.push(["Penjualan", "Metode", "Status", "Nominal"]);
  for (const line of report.sales) {
    rows.push([line.label, line.method ?? "", line.settled ? "lunas" : "belum bayar", line.amount]);
  }
  rows.push(["Total penjualan", "", "", report.totals.sales]);

  rows.push([]);
  rows.push(["TRANSAKSI KAS MANUAL"]);
  rows.push(["Arah", "Keterangan", "Nominal"]);
  for (const line of report.cashTx) {
    rows.push([
      line.direction === "pemasukan" ? "Masuk" : "Keluar",
      line.label,
      line.amount,
    ]);
  }
  rows.push(["Total masuk", "", report.totals.manualIn]);
  rows.push(["Total keluar", "", report.totals.manualOut]);

  rows.push([]);
  rows.push(["REKAP"]);
  rows.push(["Omzet servis", report.totals.services]);
  rows.push(["Omzet penjualan", report.totals.sales]);
  rows.push(["Transaksi manual", report.totals.manualNet]);
  // expectedCash, bukan totals.expected: baris ini membandingkan uang fisik di
  // laci, dan totals.expected memuat pendapatan yang tidak pernah ada di tangan.
  rows.push(["Harus ada di laci", report.expectedCash]);
  if (report.closingBalance !== null) {
    rows.push(["Saldo akhir fisik", report.closingBalance]);
    rows.push(["Selisih", report.variance ?? 0]);
    if (report.reason) rows.push(["Alasan selisih", report.reason]);
  }

  return rows;
}
