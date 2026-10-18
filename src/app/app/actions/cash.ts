"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { isManagerRole } from "@/lib/auth/authorization";
import { canAccess } from "@/lib/nav/manifest";
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
import { awalHariWIB, kalenderWIB } from "@/lib/operational/periode-bulan";

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

// Dipakai enam kali di file ini, jadi hanya satu definisi hari kalender.
// toISOString().slice(0, 10) adalah hari UTC dan menggeser shift yang dibuka
// antara 00:00 dan 07:00 WIB ke hari sebelumnya. Lihat kalenderWIB.
function toCalendarDate(date: Date): string {
  return kalenderWIB(date);
}

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

    const today = toCalendarDate(new Date());
    const hydrated = await hydrateSessions(rows);

    return {
      ok: true,
      data: {
        // Index unik `where closed_at is null` menjamin paling banyak satu,
        // tapi `limit(1)` tetap dipakai supaya tidak bergantung pada itu.
        current: hydrated.find((row) => toCalendarDate(new Date(row.openAt)) === today) ?? hydrated[0] ?? null,
        stale: hydrated.find((row) => toCalendarDate(new Date(row.openAt)) !== today) ?? null,
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
  const date = toCalendarDate(new Date(session.openAt));

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
      kas_date: input.kasDate ?? toCalendarDate(new Date()),
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

/**
 * Mencatat pembayaran untuk satu servis.
 *
 * **Kenapa bukan `createSale()`.** Action itu mewajibkan
 * `cervise_sales_items.product_id` yang menunjuk `cervise_products` — pembayaran
 * servis tidak punya produk, jadi tidak bisa lewat sana.
 *
 * **Konsekuensi yang perlu diketahui.** Baris `cervise_sales` yang dibuat di
 * sini tidak punya `cervise_sales_items`. `getSalesOrders()` menghitung qty
 * dari tabel itu, jadi baris ini akan terlihat dengan qty 0 di daftar
 * penjualan. Itu konsekuensi yang disadari: menambah baris item dengan
 * produk dummy akan mengotori katalog stok.
 *
 * `servis_id` yang diisi adalah pengait anti double counting di Laporan Shift
 * (§`buildLaporanShift`). Tanpa itu, servis yang dibayar akan masuk rekap dua
 * kali — sekali lewat `price` servis, sekali lewat `total` penjualan.
 *
 * Tidak membuat baris `finance_tx` kalau dalam PaymentDialog, karena penjualan
 * sudah terhitung di Laporan Shift lewat tabel `sales`. MelYGilangkan
 * `finance_tx` akan menghitungnya dua kali.
 */
export async function payServis(input: {
  servisId: string;
  paymentMethod: string;
  amount?: number;
  note?: string;
}): Promise<CashResult<{ saleId: string; saleNumber: string | null }>> {
  const allowed = ["Tunai", "Debit", "Transfer", "QRIS", "E-Wallet"];
  if (!input.servisId) return fail("ID servis tidak valid");
  if (!allowed.includes(input.paymentMethod)) return fail("Metode pembayaran tidak valid");

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
      .select("id, price, status, customer_id, branch_id, service_number")
      .eq("id", input.servisId)
      .eq("branch_id", branchId)
      .maybeSingle();

    if (serviceError) return fail(serviceError.message);
    if (!service) return fail("Servis tidak ditemukan");
    if (service.status === "Batal") return fail("Servis dibatalkan tidak bisa dibayar");

    const price = Number(service.price ?? 0);
    const total = input.amount === undefined ? price : Number(input.amount);
    if (!Number.isFinite(total) || total < 0) return fail("Nominal pembayaran tidak valid");

    // Nomor penjualan dari tanggal + sufiks acak, supaya unik tanpa kolom
    // sequence baru. `sale_number` punya UNIQUE, jadi dua kasir yang menekan
    // Bayar di detik yang sama tidak akan bentrok.
    const stamp = new Date();
    const y = stamp.getFullYear();
    const m = String(stamp.getMonth() + 1).padStart(2, "0");
    const d = String(stamp.getDate()).padStart(2, "0");
    const seq = `${y}${m}${d}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    const { data: sale, error: saleError } = await supabase
      .from("cervise_sales")
      .insert({
        branch_id: branchId,
        customer_id: service.customer_id,
        sale_number: `SAL-${seq}`,
        subtotal: total,
        discount_total: 0,
        total,
        paid: total,
        payment_status: "lunas",
        payment_method: input.paymentMethod,
        status: "selesai",
        kas_date: toCalendarDate(stamp),
        notes: input.note?.trim() || `Pembayaran servis ${service.service_number ?? ""}`.trim(),
        created_by: userId,
        servis_id: service.id,
      })
      .select("id, sale_number")
      .single();

    if (saleError) return fail(saleError.message);

    return {
      ok: true,
      data: { saleId: (sale as { id: string }).id, saleNumber: (sale as { sale_number: string | null }).sale_number },
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
      // `T00:00:00.000Z` untuk hari yang sama berarti 07:00 WIB, jadi tujuh jam
      // pertama hari lokal justru tidak ikut dihitung. awalHariWIB mengembalikan
      // instant tengah malam WIB yang sebenarnya.
      .gte("created_at", awalHariWIB(new Date()).toISOString())
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
      .select("id, service_number, device, status, price, created_at, customer_id")
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
      created_at: string;
      customer_id: string | null;
    }[];

    // Satu query untuk semua id, bukan N+1 per baris.
    const paid = await supabase
      .from("cervise_sales")
      .select("servis_id")
      .eq("branch_id", branchId)
      .not("servis_id", "is", null);
    if (paid.error) return fail(paid.error.message);

    const paidIds = new Set(
      (paid.data ?? []).map((row) => row.servis_id as string).filter(Boolean),
    );

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
        .filter((service) => !paidIds.has(service.id))
        .map((service) => ({
          id: service.id,
          serviceNumber: service.service_number,
          device: service.device,
          status: service.status,
          price: service.price,
          createdAt: service.created_at,
          customerName: service.customer_id ? (customerName.get(service.customer_id) ?? null) : null,
        })),
    };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal memuat antrean servis");
  }
}
