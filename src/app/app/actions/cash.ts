"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { isManagerRole } from "@/lib/auth/authorization";
import { canAccess } from "@/lib/nav/manifest";
import { businessDate, businessDayStartIso } from "@/lib/business-date";
import {
  buildFrontlinerKpi,
  type FrontlinerKpi,
} from "@/lib/operational/frontliner-dashboard";
import {
  buildLaporanShift,
  type ShiftCashRow,
  type ShiftReport,
  type ShiftSaleRow,
  type ShiftServiceRow,
  type ShiftSession,
} from "@/lib/operational/laporan-shift";

/**
 * Sesi kas harian dan Laporan Shift.
 *
 * Semua perhitungan ada di `@/lib/operational/laporan-shift`; file ini hanya
 * mengambil baris lalu meneruskannya.
 */

// Laporan shift adalah rekap satu hari kerja, bukan ekspor.
const SERVICE_ROW_CAP = 500;
const SALE_ROW_CAP = 500;
const CASH_ROW_CAP = 500;

export type CashSessionRow = ShiftSession;

export type CashResult<T> = { ok: true; data: T } | { ok: false; error: string };

function fail<T>(error: string): CashResult<T> {
  return { ok: false, error };
}

async function cashContext() {
  const actor = await getActiveTenant();
  if (!actor.branchId) throw new Error("Cabang belum ditetapkan untuk akun ini");
  return { supabase: actor.supabase, branchId: actor.branchId, userId: actor.userId, role: actor.role };
}

/**
 * Tanggal kalender untuk `kas_date` dan "hari ini".
 *
 * Dulu `toISOString().slice(0, 10)` dipakai langsung di file ini. Itu tanggal
 * UTC, sedangkan server produksi berjalan di UTC dan toko berada di WIB:
 * transaksi antara 00:00 dan 07:00 tercatat di laporan tanggal sebelumnya.
 */

// ---------------------------------------------------------------------------
// Sesi
// ---------------------------------------------------------------------------

/**
 * Sesi terbuka milik pengguna ini, atau null.
 *
 * `staleSession` mengembalikan sesi terbuka yang tanggalnya sudah lewat — tahu
 * kalau ada shift yang ditinggalkan tanpa ditutup, supaya dialog saldo awal
 * bisa memperingatkan sebelum membuat sesi baru.
 */
export async function checkOpenCashSession(): Promise<
  CashResult<{ current: CashSessionRow | null; stale: CashSessionRow | null }>
> {
  try {
    const { supabase, userId } = await cashContext();
    const { data, error } = await supabase
      .from("cervise_cash_sessions")
      .select("id, branch_id, employee_id, open_at, opening_balance, closed_at, closing_balance, variance")
      .eq("employee_id", userId)
      .is("closed_at", null)
      .order("open_at", { ascending: false });

    if (error) return fail(error.message);

    const rows = (data ?? []) as {
      id: string;
      branch_id: string;
      employee_id: string;
      open_at: string;
      opening_balance: number;
      closed_at: string | null;
      closing_balance: number | null;
      variance: number | null;
    }[];

    const today = businessDate();
    const hydrated = await hydrateSessions(rows);

    return {
      ok: true,
      data: {
        // Index unik `where closed_at is null` menjamin paling banyak satu,
        // tapi `limit(1)` tetap dipakai supaya tidak bergantung pada itu.
        current: hydrated.find((row) => businessDate(new Date(row.openAt)) === today) ?? hydrated[0] ?? null,
        stale: hydrated.find((row) => businessDate(new Date(row.openAt)) !== today) ?? null,
      },
    };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal memuat sesi kas");
  }
}

async function hydrateSessions(
  rows: { id: string; branch_id: string; employee_id: string; open_at: string; opening_balance: number; closed_at: string | null; closing_balance: number | null; variance: number | null }[],
): Promise<CashSessionRow[]> {
  if (rows.length === 0) return [];
  const { supabase } = await cashContext();

  const branchIds = [...new Set(rows.map((row) => row.branch_id))];
  const profileIds = [...new Set(rows.map((row) => row.employee_id))];

  const [branches, profiles] = await Promise.all([
    supabase.from("branches").select("id, name").in("id", branchIds),
    supabase.from("profiles").select("id, full_name").in("id", profileIds),
  ]);

  const branchName = new Map((branches.data ?? []).map((b) => [b.id as string, b.name as string]));
  const employeeName = new Map(
    (profiles.data ?? []).map((p) => [p.id as string, (p.full_name as string) ?? "Tanpa nama"]),
  );

  return rows.map((row) => ({
    id: row.id,
    branchId: row.branch_id,
    employeeId: row.employee_id,
    openAt: row.open_at,
    openingBalance: row.opening_balance,
    closedAt: row.closed_at,
    closingBalance: row.closing_balance,
    variance: row.variance,
    branchName: branchName.get(row.branch_id) ?? "—",
    employeeName: employeeName.get(row.employee_id) ?? "—",
  }));
}

/**
 * Membuka sesi kas. Wajib: tanpa ini Laporan Shift tidak punya pijakan.
 *
 * Record sesi dibuat, laporan TIDAK — di titik ini belum ada transaksi
 * untuk dilaporkan. Laporan dihitung live dari `open_at`.
 */
export async function openCashSession(input: { openingBalance: number }): Promise<CashResult<CashSessionRow>> {
  const opening = Number(input.openingBalance);
  if (!Number.isInteger(opening) || opening < 0) {
    return fail("Saldo awal harus angka bulat dan tidak boleh negatif");
  }

  try {
    const { supabase, branchId, userId } = await cashContext();

    // Optimistic lock di level aplikasi. Index unik di database
    // (`where closed_at is null`) adalah jaring kedua: kalau dua tab dibuka
    // bersamaan, satu akan gagal dengan error unik yang bisa dibaca.
    const { data: existing, error: existingError } = await supabase
      .from("cervise_cash_sessions")
      .select("id")
      .eq("employee_id", userId)
      .is("closed_at", null)
      .maybeSingle();
    if (existingError) return fail(existingError.message);
    if (existing) return fail("Masih ada sesi kas yang terbuka. Tutup toko dulu.");

    const { data, error } = await supabase
      .from("cervise_cash_sessions")
      .insert({ branch_id: branchId, employee_id: userId, opening_balance: opening })
      .select("id, branch_id, employee_id, open_at, opening_balance, closed_at, closing_balance, variance")
      .single();

    if (error) return fail(error.message);

    const [session] = await hydrateSessions([data as Parameters<typeof hydrateSessions>[0][number]]);
    return { ok: true, data: session };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal membuka sesi kas");
  }
}

/**
 * Menutup toko. Snapshot disimpan supaya laporan historis tidak berubah kalau
 * ada koreksi setelah shift ditutup.
 */
export async function closeCashSession(input: {
  sessionId: string;
  closingBalance: number;
  reason?: string;
}): Promise<CashResult<ShiftReport>> {
  const closing = Number(input.closingBalance);
  if (!Number.isInteger(closing) || closing < 0) {
    return fail("Saldo akhir harus angka bulat dan tidak boleh negatif");
  }
  if (!input.sessionId) return fail("ID sesi tidak valid");

  try {
    const { supabase, userId, role } = await cashContext();

    const isManager = isManagerRole(role);

    // Verifikasi sesi masih terbuka sebelum update. Constraint database
    // `cervise_cash_sessions_closed_check` hanya menolak update yang
    // meninggalkan kolom penutup kosong — ia tidak menolak update kedua atas
    // sesi yang sudah tertutup. Pemeriksaan ini yang menutup celah itu.
    const { data: row, error: readError } = await supabase
      .from("cervise_cash_sessions")
      .select("id, branch_id, employee_id, open_at, opening_balance, closed_at")
      .eq("id", input.sessionId)
      .maybeSingle();

    if (readError) return fail(readError.message);
    if (!row) return fail("Sesi kas tidak ditemukan");
    if (row.closed_at) return fail("Shift ini sudah ditutup sebelumnya");
    if (row.employee_id !== userId && !isManager) {
      return fail("Sesi kas ini bukan milik Anda");
    }

    const report = await computeReport(input.sessionId, row as SessionForReport);
    if (!report) return fail("Gagal menghitung laporan shift");

    const { error: updateError } = await supabase
      .from("cervise_cash_sessions")
      .update({
        closed_at: new Date().toISOString(),
        closing_balance: closing,
        expected_cash: report.totals.expected,
        variance: closing - report.totals.expected,
        snapshot: { ...report, reason: input.reason?.trim() || null },
      })
      .eq("id", input.sessionId)
      .is("closed_at", null);

    if (updateError) return fail(updateError.message);

    return {
      ok: true,
      data: { ...report, reason: input.reason?.trim() || null, closingBalance: closing, variance: closing - report.totals.expected },
    };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal menutup toko");
  }
}

type SessionForReport = {
  id: string;
  branch_id: string;
  employee_id: string;
  open_at: string;
  opening_balance: number;
  closed_at: string | null;
};

async function computeReport(sessionId: string, row: SessionForReport): Promise<ShiftReport | null> {
  const [session] = await hydrateSessions([row as never]);
  if (!session) return null;

  const { supabase, branchId } = await cashContext();
  const now = new Date();
  const date = businessDate(new Date(session.openAt));

  // Tiga query paralel. Setiap filter mengikuti bentuk kolomnya masing-masing:
  // servis pakai created_at (timestamptz, jamnya ada), penjualan dan kas
  // pakai kas_date (date, jamnya hilang) jadi satu hari penuh.
  const [servicesResult, salesResult, cashResult] = await Promise.all([
    supabase
      .from("cervise_services")
      .select("id, service_number, device, status, price, created_at, updated_at")
      .eq("branch_id", branchId)
      .gte("created_at", session.openAt)
      .order("created_at", { ascending: false })
      .limit(SERVICE_ROW_CAP),
    supabase
      .from("cervise_sales")
      .select("id, sale_number, total, paid, payment_status, payment_method, kas_date, servis_id")
      .eq("branch_id", branchId)
      .eq("kas_date", date)
      .order("created_at", { ascending: false })
      .limit(SALE_ROW_CAP),
    supabase
      .from("cervise_finance_tx")
      .select("id, type, amount, description, kas_date, source")
      .eq("branch_id", branchId)
      .eq("kas_date", date)
      .in("source", ["kas_manual", "penyesuaian"])
      .order("created_at", { ascending: false })
      .limit(CASH_ROW_CAP),
  ]);

  if (servicesResult.error) throw new Error(servicesResult.error.message);
  if (salesResult.error) throw new Error(salesResult.error.message);
  if (cashResult.error) throw new Error(cashResult.error.message);

  return buildLaporanShift({
    session,
    services: (servicesResult.data ?? []) as ShiftServiceRow[],
    sales: (salesResult.data ?? []) as ShiftSaleRow[],
    cashTx: (cashResult.data ?? []) as ShiftCashRow[],
    now,
  });
}

/** Preview live untuk dialog Tutup Toko. Tidak menyimpan apa pun. */
export async function getShiftPreview(sessionId: string): Promise<CashResult<ShiftReport>> {
  if (!sessionId) return fail("ID sesi tidak valid");
  try {
    const { supabase } = await cashContext();
    const { data, error } = await supabase
      .from("cervise_cash_sessions")
      .select("id, branch_id, employee_id, open_at, opening_balance, closed_at")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Sesi kas tidak ditemukan");

    const report = await computeReport(sessionId, data as SessionForReport);
    if (!report) return fail("Gagal menghitung laporan shift");
    return { ok: true, data: report };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal menghitung laporan shift");
  }
}

/** Laporan dari snapshot sesi yang sudah ditutup. */
export async function getShiftReport(sessionId: string): Promise<CashResult<ShiftReport>> {
  if (!sessionId) return fail("ID sesi tidak valid");
  try {
    const { supabase } = await cashContext();
    const { data, error } = await supabase
      .from("cervise_cash_sessions")
      .select("id, branch_id, employee_id, open_at, opening_balance, closed_at, closing_balance, variance, snapshot")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Sesi kas tidak ditemukan");
    if (!data.snapshot) return fail("Shift ini belum ditutup, jadi belum ada laporan final");

    return { ok: true, data: data.snapshot as ShiftReport };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal memuat laporan shift");
  }
}

/** Daftar sesi untuk halaman Laporan Shift. `scope: "branch"` melihat semua. */
export async function listShiftSessions(
  filters: { from?: string; to?: string; scope?: "mine" | "branch" } = {},
): Promise<CashResult<CashSessionRow[]>> {
  try {
    const { supabase, branchId, userId, role } = await cashContext();
    const isManager = isManagerRole(role);
    const scope = filters.scope ?? (isManager ? "branch" : "mine");

    let query = supabase
      .from("cervise_cash_sessions")
      .select("id, branch_id, employee_id, open_at, opening_balance, closed_at, closing_balance, variance")
      .eq("branch_id", branchId)
      .order("open_at", { ascending: false })
      .limit(200);

    if (scope === "mine" || !isManager) query = query.eq("employee_id", userId);
    if (filters.from) query = query.gte("open_at", filters.from);
    if (filters.to) query = query.lte("open_at", `${filters.to}T23:59:59.999Z`);

    const { data, error } = await query;
    if (error) return fail(error.message);

    const sessions = await hydrateSessions(
      (data ?? []) as Parameters<typeof hydrateSessions>[0],
    );
    return { ok: true, data: sessions };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal memuat daftar shift");
  }
}

// ---------------------------------------------------------------------------
// Kas manual
// ---------------------------------------------------------------------------

/**
 * Saldo masuk atau keluar di luar penjualan.
 *
 * Menulis ke `finance_tx` dengan `source = 'kas_manual'`, bukan ke tabel
 * terpisah — supaya Laporan Shift, Arus Kas, dan Laporan Keuangan membaca
 * angka yang sama.
 */
export async function addCashAdjustment(input: {
  direction: "pemasukan" | "pengeluaran";
  amount: number;
  description: string;
  kasDate?: string;
}): Promise<CashResult<null>> {
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    return fail("Nominal harus angka bulat lebih dari nol");
  }
  const description = input.description?.trim();
  if (!description) return fail("Keterangan wajib diisi");
  if (input.direction !== "pemasukan" && input.direction !== "pengeluaran") {
    return fail("Arah transaksi tidak valid");
  }

  try {
    const { supabase, branchId, userId } = await cashContext();
    const { error } = await supabase.from("finance_tx").insert({
      branch_id: branchId,
      type: input.direction,
      amount,
      description,
      kas_date: input.kasDate ?? businessDate(),
      created_by: userId,
      source: "kas_manual",
    });
    if (error) return fail(error.message);
    return { ok: true, data: null };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal menyimpan transaksi kas");
  }
}

// ---------------------------------------------------------------------------
// Antrean pembayaran
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pembayaran servis
// ---------------------------------------------------------------------------

export type PaymentMethod = "Tunai" | "Debit" | "Transfer" | "QRIS" | "E-Wallet";

const PAYMENT_METHODS: PaymentMethod[] = ["Tunai", "Debit", "Transfer", "QRIS", "E-Wallet"];

/**
 * Nomor penjualan dari tanggal + sufiks yang cukup panjang.
 *
 * `sale_number` punya UNIQUE. Versi lama memakai 4 karakter acak, yang pada
 * ~200 nota per hari punya peluang bentrok sekitar 2% per hari - dan bentrok
 * berarti kasir melihat error tanpa tahu kenapa.
 */
function nextServisSaleNumber(date: Date = new Date()): string {
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const suffix = `${date.getTime().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, "0")}`.toUpperCase();
  return `SAL-${stamp}-${suffix}`;
}

/**
 * Satu-satunya jalan mencatat pembayaran servis.
 *
 * **Kenapa menulis dua tabel.** Pola yang sama dipakai `createSale`: baris
 * `cervise_sales` adalah faktur (yang dibaca Laporan Penjualan dan yang membuat
 * servis ini hilang dari antrean "Bayar"), sedangkan `finance_tx` adalah buku
 * kas (yang dibaca Arus Kas dan Laporan Keuangan). Sebelumnya tiap layar
 * menulis ke tabel yang berbeda, jadi kedua laporan tidak pernah seesama.
 *
 * `buildLaporanShift` hanya menghitung `finance_tx` dengan `source` di
 * `('kas_manual','penyesuaian')`, jadi baris `source='transaksi'` ini tidak
 * menambah dua kali di shift — combined dengan `servis_id` yang mengisi
 * pengait anti-double-count.
 *
 * **Konsekuensi yang disadari.** Baris `cervise_sales` ini tidak punya
 * `cervise_sales_items`, jadi `getSalesOrders()` menampilkannya dengan qty 0.
 *
 * **Patokan lunas adalah `price_estimasi`, bukan `price`.** `price` adalah
 * total yang sudah dibayar (lihat pembaruan di bawah), jadi memakainya sebagai
 * patokan akan membuat setiap pembayaran kedua ditolak.
 */
export async function recordServisPayment(input: {
  servisId: string;
  amount?: number;
  metode: PaymentMethod;
  kasDate?: string;
  note?: string;
}): Promise<
  CashResult<{
    saleId: string;
    saleNumber: string | null;
    totalPaid: number;
    alreadyPaid: number;
  }>
> {
  if (!input.servisId) return fail("ID servis tidak valid");
  if (!PAYMENT_METHODS.includes(input.metode)) return fail("Metode pembayaran tidak valid");

  try {
    const { supabase, branchId, userId, role } = await cashContext();

    // `canAccess(role, "penjualan")` sudah menerima FRONTLINER
    // (manifest Spec 1), jadi gerbang role tidak baru. Dicetak eksplisit supaya
    // pembayaran servis tidak ikut ter-copy dari halaman penjualan tanpa gate.
    if (!canAccess(role, "penjualan")) {
      return fail("Role tidak diizinkan melakukan pembayaran");
    }

    const { data: service, error: serviceError } = await supabase
      .from("cervise_services")
      .select("id, price, price_estimasi, status, customer_id, branch_id, service_number")
      .eq("id", input.servisId)
      .eq("branch_id", branchId)
      .maybeSingle();

    if (serviceError) return fail(serviceError.message);
    if (!service) return fail("Servis tidak ditemukan");
    if (service.status === "Batal") return fail("Servis dibatalkan tidak bisa dibayar");

    const { data: paidRows, error: paidError } = await supabase
      .from("finance_tx")
      .select("amount")
      .eq("branch_id", branchId)
      .eq("servis_id", input.servisId)
      .eq("type", "pemasukan");
    if (paidError) return fail(paidError.message);
    const alreadyPaid = (paidRows ?? []).reduce(
      (sum, row) => sum + Number(row.amount ?? 0),
      0,
    );

    const quoted = Number(service.price_estimasi ?? 0);
    if (quoted > 0 && alreadyPaid >= quoted) return fail("Servis ini sudah lunas");
    const remaining = quoted > 0 ? quoted - alreadyPaid : 0;

    const amount = Math.round(
      input.amount === undefined ? remaining : Number(input.amount),
    );
    if (!Number.isFinite(amount) || amount <= 0) {
      return fail("Nominal pembayaran tidak valid");
    }

    const kasDate = input.kasDate ?? businessDate();

    const { data: sale, error: saleError } = await supabase
      .from("cervise_sales")
      .insert({
        branch_id: branchId,
        customer_id: service.customer_id,
        sale_number: nextServisSaleNumber(),
        subtotal: amount,
        discount_total: 0,
        total: amount,
        paid: amount,
        payment_status: "lunas",
        payment_method: input.metode,
        status: "selesai",
        kas_date: kasDate,
        notes:
          input.note?.trim() ||
          `Pembayaran servis ${service.service_number ?? ""}`.trim(),
        created_by: userId,
        servis_id: service.id,
      })
      .select("id, sale_number")
      .single();

    if (saleError) return fail(saleError.message);

    const { error: financeError } = await supabase.from("finance_tx").insert({
      branch_id: branchId,
      servis_id: service.id,
      type: "pemasukan",
      amount,
      kas_date: kasDate,
      metode: input.metode,
      description: `Pembayaran servis ${service.service_number ?? ""} - ${input.metode}`,
      created_by: userId,
    });
    if (financeError) return fail(financeError.message);

    const totalPaid = alreadyPaid + amount;
    if (totalPaid !== Number(service.price ?? 0)) {
      await supabase
        .from("cervise_services")
        .update({ price: totalPaid })
        .eq("id", service.id)
        .eq("branch_id", branchId);
    }

    return {
      ok: true,
      data: {
        saleId: (sale as { id: string }).id,
        saleNumber: (sale as { sale_number: string | null }).sale_number,
        totalPaid,
        alreadyPaid,
      },
    };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal menyimpan pembayaran");
  }
}

// ---------------------------------------------------------------------------
// KPI frontliner
// ---------------------------------------------------------------------------

/**
 * Tipe lived here didefinisikan di `@/lib/operational/frontliner-dashboard`
 * supaya bisa diuji tanpa Supabase. Di-reexport di sini supaya pemanggil
 * lama yang mengimpor dari actions tidak perlu diubah.
 */
export type { FrontlinerKpi } from "@/lib/operational/frontliner-dashboard";
/**
 * Empat KPI untuk dashboard kasir.
 *
 * `summarizeDashboard` yang dipakai dashboard manajer tidak punya angka
 * "diambil" dan "batal" — isinya OMZET dan garansi, bukan status servis. Jadi
 * dihitung di sini dari baris yang sama, bukan diakal ulang dari bucket.
 */
export async function getFrontlinerKpi(): Promise<CashResult<FrontlinerKpi>> {
  try {
    const { supabase, branchId } = await cashContext();
    const { data, error } = await supabase
      .from("cervise_services")
      .select("status, created_at")
      .eq("branch_id", branchId)
      .gte("created_at", businessDayStartIso())
      .limit(SERVICE_ROW_CAP);
    if (error) return fail(error.message);

    const rows = (data ?? []) as { status: string; created_at: string }[];

    return { ok: true, data: buildFrontlinerKpi(rows) };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal memuat KPI");
  }
}

export type FrontlinerQueueItem = {
  id: string;
  serviceNumber: string | null;
  device: string;
  status: string;
  price: number;
  /**
   * Harga yang disepakati teknisi; null/0 = belum ada estimasi.
   *
   * Yang dibutuhkan kasir untuk prefilling nominal, karena `price` adalah total
   * yang sudah dibayar, bukan sisa tagihan.
   */
  priceEstimasi: number | null;
  createdAt: string;
  customerName: string | null;
};

/**
 * Servis hari ini yang belum punya penjualan terkait — itu antrean "Bayar".
 */
export async function getFrontlinerQueue(): Promise<CashResult<FrontlinerQueueItem[]>> {
  try {
    const { supabase, branchId } = await cashContext();

    // Antrean = semua servis yang belum punya penjualan terkait, bukan hanya
    // hari ini. Membatasi ke hari ini akan menyembunyikan servis yang tertinggal
    // dari kemarin dan tidak pernah dibayar — justru yang paling butuh ditagih.
    // Urutan terbaru dulu, dan dibatasi supaya antrean panjang tidak
    // menjadi lambat.
    const { data, error } = await supabase
      .from("cervise_services")
      .select("id, service_number, device, status, price, price_estimasi, created_at, customer_id")
      .eq("branch_id", branchId)
      .not("status", "in", '("Batal")')
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return fail(error.message);

    const services = (data ?? []) as {
      id: string;
      service_number: string | null;
      device: string;
      status: string;
      price: number;
      price_estimasi: number | null;
      created_at: string;
      customer_id: string | null;
    }[];

    // Satu query untuk semua id, bukan N+1 per baris.
    //
    // KEDUA tabel wajib dibaca. Dulu hanya `cervise_sales` yang dicek, padahal
    // pembayaran lewat drawer detail servis tercatat di `finance_tx` - jadi
    // servis yang sudah lunas tetap muncul di antrean ini dan bisa dibayar
    // lagi. Baris lama yang hanya ada di salah satu tabel harus tetap
    // terhitung.
    const [paidSales, paidFinance] = await Promise.all([
      supabase
        .from("cervise_sales")
        .select("servis_id")
        .eq("branch_id", branchId)
        .not("servis_id", "is", null),
      supabase
        .from("finance_tx")
        .select("servis_id, amount")
        .eq("branch_id", branchId)
        .eq("type", "pemasukan")
        .not("servis_id", "is", null),
    ]);
    if (paidSales.error) return fail(paidSales.error.message);
    if (paidFinance.error) return fail(paidFinance.error.message);

    // Baris di `cervise_sales` berarti `recordServisPayment` sudah mencatat
    // pembayaran, jadi possessingnya berarti sudah lunas. Baris `finance_tx`
    // bisa DP atau pelunasan, jadi nilainya harus dibandingkan dengan estimasi.
    const saleIds = new Set(
      (paidSales.data ?? []).map((row) => row.servis_id as string).filter(Boolean),
    );

    // DP yang sudah tercatat tidak boleh menghapus servis dari antrean - sisa
    // tagihan masih harus bisa dibayar. Yang dikeluarkan hanya yang sudah
    // lunas terhadap estimasinya. Servis tanpa estimasi tidak bisa dipastikan
    // lunas, jadi tetap ditampilkan.
    const paidAmountByService = new Map<string, number>();
    for (const row of (paidFinance.data ?? []) as { servis_id: string; amount: number }[]) {
      paidAmountByService.set(
        row.servis_id,
        (paidAmountByService.get(row.servis_id) ?? 0) + Number(row.amount ?? 0),
      );
    }
    const isLunas = (service: (typeof services)[number]) => {
      const estimasi = Number(service.price_estimasi ?? 0);
      if (estimasi <= 0) return false;
      return (paidAmountByService.get(service.id) ?? 0) >= estimasi;
    };

    const customerIds = [...new Set(services.map((s) => s.customer_id).filter(Boolean))] as string[];
    const customers = customerIds.length
      ? await supabase.from("cervise_customers").select("id, name").in("id", customerIds)
      : { data: [] as { id: string; name: string }[] };
    const customerName = new Map(
      (customers.data ?? []).map((c) => [c.id as string, c.name as string]),
    );

    return {
      ok: true,
      data: services
        .filter((service) => !saleIds.has(service.id) && !isLunas(service))
        .map((service) => ({
          id: service.id,
          serviceNumber: service.service_number,
          device: service.device,
          status: service.status,
          price: service.price,
          priceEstimasi:
            service.price_estimasi == null ? null : Number(service.price_estimasi),
          alreadyPaid: paidAmountByService.get(service.id) ?? 0,
          createdAt: service.created_at,
          customerName: service.customer_id ? (customerName.get(service.customer_id) ?? null) : null,
        })),
    };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal memuat antrean servis");
  }
}
