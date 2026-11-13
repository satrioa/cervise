"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import {
  buildBranches,
  buildBranchRevenueTrend,
  buildDashboardFeed,
  buildProblems,
  buildTechnicians,
  summarizeDashboard,
  type DashboardActivityTerrain,
  type DashboardBranch,
  type DashboardCashSession,
  type DashboardFeedItem,
  type DashboardFinance,
  type DashboardPeriod,
  type DashboardProfile,
  type DashboardSale,
  type DashboardService,
  type DashboardServiceLog,
  type DashboardTechnician,
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
const SALE_ROW_CAP = 5000;

export type DashboardData = {
  period: DashboardPeriod;
  branchLabel: string;
  summary: DashboardSummary;
  technicians: DashboardTechnician[];
  problems: DashboardProblem[];
  branches: DashboardBranch[];
  feed: DashboardFeedItem[];
  activityTerrain: DashboardActivityTerrain;
};

function activityStartIso(period: DashboardPeriod, now: Date): string {
  const days = period === "hari ini" ? 14 : period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const start = new Date(now.getTime());
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start.toISOString();
}

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
      .select("id, branch_id, type, amount, kas_date, created_at, description, metode, servis_id, created_by"),
    actor,
  );
  const logsQuery = applyBranchScope(
    supabase
      .from("cervise_service_logs")
      .select("id, created_at, action, from_value, to_value, servis_id, actor_id"),
    actor,
  );
  const sessionsQuery = applyBranchScope(
    supabase
      .from("cervise_cash_sessions")
      .select("id, open_at, closed_at, employee_id, opening_balance, closing_balance"),
    actor,
  );
  const salesQuery = applyBranchScope(
    supabase.from("cervise_sales").select("id, created_at"),
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

  const since = periodStartIso(period, now);
  const activitySince = activityStartIso(period, now);

  // Feed menyediakan filter Hari ini/Kemarin, jadi sumbernya minimal sejak awal
  // kemarin walau periode chart hanya "hari ini".
  const feedStart = new Date(now);
  feedStart.setHours(0, 0, 0, 0);
  feedStart.setDate(feedStart.getDate() - 1);
  const feedSince = new Date(Math.min(new Date(since).getTime(), feedStart.getTime()));

  const [servicesResult, financeResult, branchResult, logsResult, sessionsResult, salesResult] = await Promise.all([
    servicesQuery.order("created_at", { ascending: false }).limit(SERVICE_ROW_CAP),
    financeQuery
      .gte("kas_date", toLocalDateString(feedSince))
      .lte("kas_date", toLocalDateString(now))
      .limit(FINANCE_ROW_CAP),
    branchQuery,
    logsQuery.gte("created_at", feedSince.toISOString()).order("created_at", { ascending: false }).limit(200),
    sessionsQuery.gte("open_at", feedSince.toISOString()).order("open_at", { ascending: false }).limit(50),
    salesQuery.gte("created_at", activitySince).order("created_at", { ascending: false }).limit(SALE_ROW_CAP),
  ]);

  if (servicesResult.error) throw new Error(servicesResult.error.message);
  if (financeResult.error) throw new Error(financeResult.error.message);
  if (branchResult.error) throw new Error(branchResult.error.message);
  if (logsResult.error) throw new Error(logsResult.error.message);
  if (sessionsResult.error) throw new Error(sessionsResult.error.message);
  if (salesResult.error) throw new Error(salesResult.error.message);

  const services = (servicesResult.data ?? []) as DashboardService[];
  const finance = (financeResult.data ?? []) as DashboardFinance[];
  const sales = (salesResult.data ?? []) as DashboardSale[];
  const logs = (logsResult.data ?? []) as DashboardServiceLog[];
  const sessions = (sessionsResult.data ?? []) as DashboardCashSession[];
  const branchRows = allScope
    ? ((branchResult.data ?? []) as { id: string; name: string }[])
    : branchResult.data
      ? [branchResult.data as { id: string; name: string }]
      : [];

  const teknisiIds = Array.from(new Set(services.map((s) => s.teknisi_id).filter((id): id is string => Boolean(id))));
  const actorIds = Array.from(
    new Set([
      ...logs.map((log) => log.actor_id).filter((id): id is string => Boolean(id)),
      ...finance.map((tx) => tx.created_by).filter((id): id is string => Boolean(id)),
      ...sessions.map((session) => session.employee_id).filter((id): id is string => Boolean(id)),
    ]),
  );
  const profileIds = Array.from(new Set([...teknisiIds, ...actorIds]));

  const profilesResult = profileIds.length
    ? await supabase.from("profiles").select("id, full_name, branch_id").in("id", profileIds)
    : { data: [], error: null };
  if (profilesResult.error) throw new Error(profilesResult.error.message);

  const summary = summarizeDashboard({ services, finance, sales, period, now });
  summary.branchTrend = buildBranchRevenueTrend({ finance, branches: branchRows, period, now });
  return {
    period,
    branchLabel: allScope ? "Semua cabang" : branchRows[0]?.name ?? "—",
    summary,
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
    feed: buildDashboardFeed({
      services,
      logs,
      finance,
      sessions,
      actors: (profilesResult.data ?? []) as { id: string; full_name: string | null }[],
      limit: 200,
    }),
    activityTerrain: summary.activityTerrain,
  };
}

async function getActiveTenantBranch() {
  const actor = await getActiveTenant();
  return { supabase: actor.supabase, actor };
}
