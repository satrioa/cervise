"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { buildLaporanKeuangan, type FinanceTx, type LaporanKeuangan } from "@/lib/operational/laporan-keuangan";

const ROW_CAP = 1000;

export type FinanceData = {
  transactions: FinanceTx[];
  branches: { id: string; name: string }[];
  report: LaporanKeuangan;
};

export type FinanceResult = { data: FinanceData; error: string | null };

async function loadFinance(): Promise<FinanceData> {
  const { supabase } = await getActiveTenant();

  const [transactionsResult, branchesResult] = await Promise.all([
    supabase
      .from("cervise_finance_tx")
      .select("id, amount, type, kas_date, branch_id, description, metode, created_at")
      .order("kas_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(ROW_CAP),
    supabase.from("branches").select("id, name").order("name"),
  ]);

  if (transactionsResult.error) throw new Error(transactionsResult.error.message);
  if (branchesResult.error) throw new Error(branchesResult.error.message);

  const transactions = (transactionsResult.data ?? []) as FinanceTx[];
  const branches = (branchesResult.data ?? []) as { id: string; name: string }[];

  return {
    transactions,
    branches,
    report: buildLaporanKeuangan({ transactions, branches, now: new Date() }),
  };
}

/**
 * Both "Transaksi" and "Arus Kas" read the same finance_tx ledger, so they share
 * one server fetch. Errors are returned rather than thrown so the pages can show
 * them instead of substituting placeholder rows.
 */
export async function getFinanceLedger(): Promise<FinanceResult> {
  try {
    return { data: await loadFinance(), error: null };
  } catch (cause) {
    return {
      data: { transactions: [], branches: [], report: buildLaporanKeuangan({ transactions: [], branches: [], now: new Date() }) },
      error: cause instanceof Error ? cause.message : "Gagal memuat data keuangan",
    };
  }
}
