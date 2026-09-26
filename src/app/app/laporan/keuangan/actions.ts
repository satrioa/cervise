"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { buildLaporanKeuangan, type FinanceTx, type LaporanKeuangan } from "@/lib/operational/laporan-keuangan";

const TX_ROW_CAP = 2000;

export type LaporanKeuanganData = {
  report: LaporanKeuangan;
  branches: { id: string; name: string }[];
  // Raw rows so the print views can itemise real transactions.
  transactions: FinanceTx[];
};

export type LaporanKeuanganQuery = {
  from?: string;
  to?: string;
  branchId?: string;
};

export async function getLaporanKeuangan(query: LaporanKeuanganQuery): Promise<LaporanKeuanganData> {
  const actor = await getActiveTenant();
  if (!actor.branchId) throw new Error("Branch not set for tenant");
  const { supabase } = actor;

  const branchesResult = await supabase.from("branches").select("id, name").order("name");
  if (branchesResult.error) throw new Error(branchesResult.error.message);
  const branches = (branchesResult.data ?? []) as { id: string; name: string }[];

  let request = supabase
    .from("cervise_finance_tx")
    .select("id, amount, type, kas_date, branch_id, description, metode")
    .order("kas_date", { ascending: false })
    .limit(TX_ROW_CAP);

  if (query.from) request = request.gte("kas_date", query.from);
  if (query.to) request = request.lte("kas_date", query.to);
  if (query.branchId && query.branchId !== "all") request = request.eq("branch_id", query.branchId);

  const { data, error } = await request;
  if (error) throw new Error(error.message);

  const transactions = (data ?? []) as FinanceTx[];

  return {
    report: buildLaporanKeuangan({ transactions, branches, now: new Date() }),
    branches,
    transactions,
  };
}
