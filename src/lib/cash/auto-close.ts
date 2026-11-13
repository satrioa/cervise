import { kalenderWIB } from "@/lib/operational/periode-bulan";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeShiftReport,
  hydrateSessions,
  type CashSessionRecord,
  type HomeContext,
} from "@/lib/home/home-data";

/**
 * Tutup otomatis shift yang lupa ditutup.
 *
 * Sistem tidak tahu uang fisik di laci, jadi saldo akhir disamakan dengan uang
 * yang seharusnya ada dan selisihnya 0. Laporan mencatat "Sistem" sebagai
 * penutup supaya angka itu tidak disalahartikan sebagai hitungan manual.
 */

export const AUTO_CLOSE_REASON =
  "Ditutup otomatis oleh sistem karena shift melewati batas tutup buku.";

export type AutoCloseResult = {
  closed: number;
  skipped: number;
  failed: number;
  errors: string[];
};

/** Instant cutoff WIB hari ini dari nilai `time` Postgres (mis. "03:00:00"). */
export function autoCloseCutoff(now: Date, time: string): Date {
  const match = /^(\d{2}):(\d{2})/.exec(time);
  const hour = match ? Number(match[1]) : 3;
  const minute = match ? Number(match[2]) : 0;
  // `+07:00` ditulis eksplisit; WIB tidak punya DST.
  return new Date(`${kalenderWIB(now)}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`);
}

/**
 * Sesi layak ditutup kalau cutoff hari ini sudah lewat DAN sesi dibuka sebelum
 * cutoff itu. Shift yang dibuka setelah cutoff adalah shift hari baru dan
 * menunggu cutoff besok.
 */
export function shouldAutoClose(openAt: string, now: Date, time: string): boolean {
  const opened = new Date(openAt);
  if (Number.isNaN(opened.getTime())) return false;
  const cutoff = autoCloseCutoff(now, time);
  return now >= cutoff && opened < cutoff;
}

export async function autoCloseShifts(now: Date = new Date()): Promise<AutoCloseResult> {
  const db = createAdminClient() as unknown as HomeContext["supabase"];
  const result: AutoCloseResult = { closed: 0, skipped: 0, failed: 0, errors: [] };

  const { data: sessions, error } = await db
    .from("cervise_cash_sessions")
    .select("id, branch_id, employee_id, open_at, opening_balance, closed_at")
    .is("closed_at", null);
  if (error) throw new Error(error.message);
  if (!sessions?.length) return result;

  const branchIds = [...new Set(sessions.map((row) => row.branch_id as string))];
  const { data: branches, error: branchError } = await db
    .from("branches")
    .select("id, organization_id")
    .in("id", branchIds);
  if (branchError) throw new Error(branchError.message);

  const orgByBranch = new Map(
    (branches ?? []).map((row) => [row.id as string, row.organization_id as string | null]),
  );
  const orgIds = [...new Set([...orgByBranch.values()].filter(Boolean))] as string[];
  if (orgIds.length === 0) {
    result.skipped = sessions.length;
    return result;
  }

  const { data: orgs, error: orgError } = await db
    .from("organizations")
    .select("id, auto_close_enabled, auto_close_time")
    .in("id", orgIds);
  if (orgError) throw new Error(orgError.message);

  const settingsByOrg = new Map(
    (orgs ?? []).map((row) => [
      row.id as string,
      {
        enabled: (row.auto_close_enabled as boolean | null) ?? true,
        time: (row.auto_close_time as string | null) ?? "03:00:00",
      },
    ]),
  );

  for (const session of sessions) {
    const orgId = orgByBranch.get(session.branch_id as string);
    const settings = orgId ? settingsByOrg.get(orgId) : undefined;
    if (!settings?.enabled) {
      result.skipped += 1;
      continue;
    }
    if (!shouldAutoClose(session.open_at as string, now, settings.time)) {
      result.skipped += 1;
      continue;
    }

    try {
      const ctx: HomeContext = {
        supabase: db,
        branchId: session.branch_id as string,
        userId: session.employee_id as string,
        role: "SYSTEM",
      };
      const [hydrated] = await hydrateSessions(db, [session as CashSessionRecord]);
      const report = await computeShiftReport(ctx, hydrated);
      const closedAt = now.toISOString();

      const { data: closed, error: updateError } = await db
        .from("cervise_cash_sessions")
        .update({
          closed_at: closedAt,
          closing_balance: report.expectedCash,
          expected_cash: report.expectedCash,
          variance: 0,
          snapshot: {
            ...report,
            closingBalance: report.expectedCash,
            variance: 0,
            reason: AUTO_CLOSE_REASON,
            closedByName: "Sistem",
          },
        })
        .eq("id", session.id)
        .is("closed_at", null)
        .select("id")
        .maybeSingle();

      if (updateError) throw new Error(updateError.message);
      // Sudah ditutup manual di antara query dan update: bukan kegagalan.
      if (!closed) {
        result.skipped += 1;
        continue;
      }

      // Serah terima tertunda ikut selesai; tidak ada yang perlu dilanjutkan.
      await db
        .from("cervise_cash_session_handovers")
        .update({ resumed_at: closedAt })
        .eq("session_id", session.id)
        .is("resumed_at", null);

      result.closed += 1;
    } catch (cause) {
      result.failed += 1;
      result.errors.push(
        `${session.id}: ${cause instanceof Error ? cause.message : "gagal menutup shift"}`,
      );
    }
  }

  return result;
}
