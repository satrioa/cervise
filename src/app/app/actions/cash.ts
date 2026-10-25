"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { isManagerRole } from "@/lib/auth/authorization";
import type { FrontlinerKpi } from "@/lib/operational/frontliner-dashboard";
import type { ShiftReport, ShiftSession } from "@/lib/operational/laporan-shift";
import { kalenderWIB } from "@/lib/operational/periode-bulan";
import {
  computeShiftReport,
  hydrateSessions,
  loadCashSession,
  loadCashSessionRecord,
  loadFrontlinerKpi,
  loadFrontlinerQueue,
  type CashSessionRecord,
} from "@/lib/home/home-data";
import type { FrontlinerQueueItem } from "@/lib/home/types";

/**
 * Sesi kas harian dan Laporan Shift.
 *
 * Semua perhitungan ada di `@/lib/operational/laporan-shift`; pemuatan barisnya
 * ada di `@/lib/home/home-data`. File ini hanya menyediakan pintu server action
 * (resolve aktor sekali, lalu teruskan konteksnya) supaya dialog dan halaman
 * lain bisa memanggilnya dari klien.
 */

export type { FrontlinerQueueItem } from "@/lib/home/types";

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
 * `staleSession` mengembalikan sesi terbuka yang tanggalnya sudah lewat â€” tahu
 * kalau ada shift yang ditinggalkan tanpa ditutup, supaya dialog saldo awal
 * bisa memperingatkan sebelum membuat sesi baru.
 */
export async function checkOpenCashSession(): Promise<
  CashResult<{ current: CashSessionRow | null; stale: CashSessionRow | null }>
> {
  try {
    return { ok: true, data: await loadCashSession(await cashContext()) };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal memuat sesi kas");
  }
}

/**
 * Membuka sesi kas. Wajib: tanpa ini Laporan Shift tidak punya pijakan.
 *
 * Record sesi dibuat, laporan TIDAK â€” di titik ini belum ada transaksi
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

    const [session] = await hydrateSessions(supabase, [data as CashSessionRecord]);
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
    const ctx = await cashContext();
    const { supabase, userId, role } = ctx;

    const isManager = isManagerRole(role);

    // Verifikasi sesi masih terbuka sebelum update. Constraint database
    // `cervise_cash_sessions_closed_check` hanya menolak update yang
    // meninggalkan kolom penutup kosong â€” ia tidak menolak update kedua atas
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

    const [session] = await hydrateSessions(supabase, [row as CashSessionRecord]);
    const report = await computeShiftReport(ctx, session);
    if (!report) return fail("Gagal menghitung laporan shift");

    // `expected_cash` dan `variance` memakai report.expectedCash, bukan
    // report.totals.expected. Yang kedua adalah omzet: penjualan non-Tunai dan
    // pendapatan servis ikut di dalamnya, dan keduanya tidak pernah ada di
    // tangan. Menyimpannya ke kolom `expected_cash` membuat angka di struk
    // thermal dan di getShiftReport tidak cocok dengan isi laci sungguhan.
    const { data: closed, error: updateError } = await supabase
      .from("cervise_cash_sessions")
      .update({
        closed_at: new Date().toISOString(),
        closing_balance: closing,
        expected_cash: report.expectedCash,
        variance: closing - report.expectedCash,
        snapshot: { ...report, reason: input.reason?.trim() || null },
      })
      .eq("id", input.sessionId)
      .is("closed_at", null)
      // Tanpa select, update yang cocok 0 baris tetap dilaporkan PostgREST
      // sebagai sukses. Dua admin menekan Tutup Toko pada sesi yang sama ->
      // yang kedua menulis nol baris, tanpa error, lalu struk thermal
      // dicetak untuk angka yang tidak pernah disimpan.
      .select("id")
      .maybeSingle();

    if (updateError) return fail(updateError.message);
    if (!closed) return fail("Shift sudah ditutup oleh orang lain. Muat ulang.");

    return {
      ok: true,
      data: {
        ...report,
        reason: input.reason?.trim() || null,
        closingBalance: closing,
        variance: closing - report.expectedCash,
      },
    };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal menutup toko");
  }
}

/** Preview live untuk dialog Tutup Toko. Tidak menyimpan apa pun. */
export async function getShiftPreview(sessionId: string): Promise<CashResult<ShiftReport>> {
  if (!sessionId) return fail("ID sesi tidak valid");
  try {
    const ctx = await cashContext();
    const record = await loadCashSessionRecord(ctx, sessionId);
    const [session] = await hydrateSessions(ctx.supabase, [record]);

    const report = await computeShiftReport(ctx, session);
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

    const sessions = await hydrateSessions(supabase, (data ?? []) as CashSessionRecord[]);
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
 * terpisah â€” supaya Laporan Shift, Arus Kas, dan Laporan Keuangan membaca
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
// KPI frontliner
// ---------------------------------------------------------------------------

/**
 * Tipe hidup di `@/lib/operational/frontliner-dashboard` supaya bisa diuji
 * tanpa Supabase. Di-reexport di sini supaya pemanggil lama yang mengimpor dari
 * actions tidak perlu diubah.
 */
export type { FrontlinerKpi } from "@/lib/operational/frontliner-dashboard";

/**
 * Empat KPI untuk dashboard kasir.
 *
 * Dihitung database (`count`), bukan dari ratusan baris yang diunduh lalu
 * disaring di sini. Definisinya tetap satu: `buildFrontlinerKpiFromCounts` di
 * `@/lib/operational/frontliner-dashboard`.
 */
export async function getFrontlinerKpi(): Promise<CashResult<FrontlinerKpi>> {
  try {
    return { ok: true, data: await loadFrontlinerKpi(await cashContext()) };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal memuat KPI");
  }
}

/**
 * Servis yang belum punya penjualan terkait — itu antrean "Bayar".
 */
export async function getFrontlinerQueue(): Promise<CashResult<FrontlinerQueueItem[]>> {
  try {
    return { ok: true, data: await loadFrontlinerQueue(await cashContext()) };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal memuat antrean servis");
  }
}
