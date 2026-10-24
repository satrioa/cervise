"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import {
  buildBranches,
  buildProblems,
  buildRecentActivity,
  buildTechnicians,
  summarizeDashboard,
  type DashboardBranch,
  type DashboardFinance,
  type DashboardPeriod,
  type DashboardProfile,
  type DashboardService,
  type DashboardTechnician,
  type DashboardActivity,
  type DashboardProblem,
  type DashboardSummary,
} from "@/lib/operational/dashboard";
import { toLocalDateString } from "@/lib/operational/garansi-list";
import {
  applyBranchScope,
  isAllBranchScope,
  NEVER_MATCH_BRANCH_ID,
} from "@/lib/supabase/branch-scope";

// Keeps the payload bounded; the dashboard is a trend view, not an export.
const SERVICE_ROW_CAP = 2000;
const FINANCE_ROW_CAP = 5000;

export type DashboardData = {
  period: DashboardPeriod;
  branchLabel: string;
  summary: DashboardSummary;
  technicians: DashboardTechnician[];
  problems: DashboardProblem[];
  branches: DashboardBranch[];
  recent: DashboardActivity[];
};

function periodStartIso(period: DashboardPeriod, now: Date): string {
  const start = new Date(now.getTime());
  if (period === "hari ini") start.setHours(0, 0, 0, 0);
  else start.setDate(start.getDate() - (period === "7d" ? 6 : period === "30d" ? 29 : 89));
  return start.toISOString();
}

export async function getDashboardData(period: DashboardPeriod): Promise<DashboardData> {
  const { supabase, actor } = await getActiveTenantBranch();
  const allScope = isAllBranchScope(actor);
  const now = new Date();

  const servicesQuery = applyBranchScope(
    supabase
      .from("cervise_services")
      .select("id, device, status, created_at, updated_at, customer_id, teknisi_id, kerusakan, garansi_value, garansi_unit, garansi_until"),
    actor,
  );
  const financeQuery = applyBranchScope(
    supabase
      .from("cervise_finance_tx")
      .select("branch_id, type, amount, kas_date"),
    actor,
  );
  const branchQuery = allScope
    ? supabase
        .from("branches")
        .select("id, name")
        .in("id", actor.accessibleBranchIds ?? [])
        .order("name")
    : supabase
        .from("branches")
        .select("id, name")
        .eq("id", actor.branchId ?? NEVER_MATCH_BRANCH_ID)
        .maybeSingle();

  const [servicesResult, financeResult, branchResult] = await Promise.all([
    servicesQuery.order("created_at", { ascending: false }).limit(SERVICE_ROW_CAP),
    financeQuery
      .gte("kas_date", toLocalDateString(new Date(periodStartIso(period, now))))
      .lte("kas_date", toLocalDateString(now))
      .limit(FINANCE_ROW_CAP),
    branchQuery,
  ]);

  if (servicesResult.error) throw new Error(servicesResult.error.message);
  if (financeResult.error) throw new Error(financeResult.error.message);
  if (branchResult.error) throw new Error(branchResult.error.message);

  const services = (servicesResult.data ?? []) as DashboardService[];
  const finance = (financeResult.data ?? []) as DashboardFinance[];
  const branchRows = allScope
    ? ((branchResult.data ?? []) as { id: string; name: string }[])
    : branchResult.data
      ? [branchResult.data as { id: string; name: string }]
      : [];

  const teknisiIds = Array.from(new Set(services.map((s) => s.teknisi_id).filter((id): id is string => Boolean(id))));
  const customerIds = Array.from(new Set(services.map((s) => s.customer_id).filter((id): id is string => Boolean(id))));

  const [profilesResult, customersResult] = await Promise.all([
    teknisiIds.length
      ? supabase.from("profiles").select("id, full_name, branch_id").in("id", teknisiIds)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length
      ? supabase.from("cervise_customers").select("id, name").in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error) throw new Error(profilesResult.error.message);
  if (customersResult.error) throw new Error(customersResult.error.message);

  return {
    period,
    branchLabel: allScope ? "Semua cabang" : branchRows[0]?.name ?? "—",
    summary: summarizeDashboard({ services, finance, period, now }),
    technicians: buildTechnicians({
      services,
      profiles: (profilesResult.data ?? []) as DashboardProfile[],
      period,
      now,
    }),
    problems: buildProblems({ services, period, now }),
    branches: buildBranches({
      finance,
      branches: branchRows,
      period,
      now,
    }),
    recent: buildRecentActivity({
      services,
      customers: (customersResult.data ?? []) as { id: string; name: string }[],
      limit: 5,
    }),
  };
}

async function getActiveTenantBranch() {
  const actor = await getActiveTenant();
  return { supabase: actor.supabase, actor };
}
