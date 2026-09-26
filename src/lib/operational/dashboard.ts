import { resolveGaransiUntil } from "./garansi-list";

export const DASHBOARD_PERIODS = ["hari ini", "7d", "30d", "90d"] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export type DashboardService = {
  id: string;
  device: string;
  status: string;
  created_at: string;
  updated_at: string | null;
  customer_id?: string | null;
  teknisi_id: string | null;
  kerusakan: string[] | null;
  garansi_value: number | null;
  garansi_unit: string | null;
  garansi_until: string | null;
};

export type DashboardFinance = {
  branch_id: string;
  type: string;
  amount: number;
  kas_date: string;
};

export type DashboardProfile = {
  id: string;
  full_name: string | null;
  branch_id: string | null;
};

export type DashboardBucket = {
  key: string;
  masuk: number;
  diambil: number;
  batal: number;
};

export type DashboardTechnician = {
  id: string | null;
  name: string;
  initials: string;
  branchId: string | null;
  count: number;
  share: number;
};

export type DashboardProblem = {
  problem: string;
  count: number;
  change: null;
};

export type DashboardBranch = {
  id: string;
  name: string;
  pendapatan: number;
};

export type DashboardActivity = {
  id: string;
  device: string;
  status: string;
  customer: string;
  createdAt: string;
};

export type DashboardSummary = {
  totalServis: number;
  pendingKonfirmasi: number;
  omzet: number;
  pengeluaran: number;
  garansiAktif: number;
  buckets: DashboardBucket[];
  bucketTotal: number;
};

const MS_PER_HOUR = 3_600_000;

function startOfDay(date: Date): Date {
  const result = new Date(date.getTime());
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;

export function buildBuckets(
  period: DashboardPeriod,
  now: Date,
): { key: string; start: Date; end: Date }[] {
  if (period === "hari ini") {
    const midnight = startOfDay(now);
    return Array.from({ length: 24 }, (_, hour) => {
      const start = new Date(midnight.getTime() + hour * MS_PER_HOUR);
      return {
        key: `${pad(hour)}:00`,
        start,
        end: new Date(start.getTime() + MS_PER_HOUR),
      };
    });
  }

  if (period === "90d") {
    const starts = Array.from({ length: 12 }, (_, week) =>
      addDays(startOfDay(now), -((12 - 1 - week) * 7)),
    );
    return starts.map((start, week) => ({
      key: `${pad(start.getDate())} ${start.toLocaleString("id-ID", { month: "short" })}`,
      start,
      end: week === starts.length - 1 ? new Date(now.getTime()) : starts[week + 1],
    }));
  }

  const days = period === "7d" ? 7 : 30;
  const starts = Array.from({ length: days }, (_, index) => addDays(startOfDay(now), -(days - 1 - index)));
  return starts.map((start, index) => ({
    key:
      period === "7d"
        ? `${DAY_LABELS[start.getDay()]} ${start.getDate()}`
        : `${start.getDate()} ${start.toLocaleString("id-ID", { month: "short" })}`,
    start,
    end: index === starts.length - 1 ? new Date(now.getTime()) : starts[index + 1],
  }));
}

function periodStart(period: DashboardPeriod, now: Date): number {
  if (period === "hari ini") return startOfDay(now).getTime();
  return buildBuckets(period, now)[0].start.getTime();
}

function bucketIndexFor(buckets: { start: Date; end: Date }[], timestamp: number): number {
  for (let index = 0; index < buckets.length; index += 1) {
    const bucket = buckets[index];
    if (timestamp >= bucket.start.getTime() && timestamp < bucket.end.getTime()) return index;
  }
  return -1;
}

/** `kas_date` is a plain date, so compare it against local calendar days. */
function financeDateInRange(kasDate: string, start: number, now: Date): boolean {
  const parsed = new Date(`${kasDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() >= start && parsed.getTime() <= now.getTime();
}

export function summarizeDashboard(input: {
  services: DashboardService[];
  finance: DashboardFinance[];
  period: DashboardPeriod;
  now: Date;
}): DashboardSummary {
  const { services, finance, period, now } = input;
  const windows = buildBuckets(period, now);
  const buckets: DashboardBucket[] = windows.map((window) => ({
    key: window.key,
    masuk: 0,
    diambil: 0,
    batal: 0,
  }));

  let totalServis = 0;
  for (const service of services) {
    const created = new Date(service.created_at).getTime();
    if (Number.isNaN(created) || created < periodStart(period, now) || created > now.getTime()) continue;
    totalServis += 1;
    const index = bucketIndexFor(windows, created);
    if (index >= 0) buckets[index].masuk += 1;

    const updated = service.updated_at ? new Date(service.updated_at).getTime() : Number.NaN;
    if (!Number.isNaN(updated)) {
      const updatedIndex = bucketIndexFor(windows, updated);
      if (updatedIndex >= 0) {
        if (service.status === "Sudah Diambil") buckets[updatedIndex].diambil += 1;
        if (service.status === "Batal") buckets[updatedIndex].batal += 1;
      }
    }
  }

  const start = periodStart(period, now);
  let omzet = 0;
  let pengeluaran = 0;
  for (const entry of finance) {
    if (!financeDateInRange(entry.kas_date, start, now)) continue;
    const amount = Number(entry.amount ?? 0);
    if (entry.type === "pemasukan") omzet += amount;
    else if (entry.type === "pengeluaran") pengeluaran += amount;
  }

  const pendingKonfirmasi = services.filter((service) => service.status === "Menunggu Konfirmasi").length;

  const garansiAktif = services.filter((service) => {
    const until = resolveGaransiUntil(service);
    return until !== null && until.getTime() >= now.getTime();
  }).length;

  return {
    totalServis,
    pendingKonfirmasi,
    omzet,
    pengeluaran,
    garansiAktif,
    buckets,
    bucketTotal: buckets.reduce((total, bucket) => total + bucket.masuk, 0),
  };
}

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function buildTechnicians(input: {
  services: DashboardService[];
  profiles: DashboardProfile[];
  period: DashboardPeriod;
  now: Date;
}): DashboardTechnician[] {
  const { services, profiles, period, now } = input;
  const start = periodStart(period, now);
  const counts = new Map<string, number>();
  for (const service of services) {
    if (!service.teknisi_id) continue;
    const created = new Date(service.created_at).getTime();
    if (Number.isNaN(created) || created < start || created > now.getTime()) continue;
    counts.set(service.teknisi_id, (counts.get(service.teknisi_id) ?? 0) + 1);
  }
  if (counts.size === 0) return [];

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const ranked = Array.from(counts.entries())
    .map(([id, count]) => {
      const profile = profilesById.get(id);
      const name = profile?.full_name?.trim() || "Tanpa nama";
      return { id, name, initials: initialsOf(name), branchId: profile?.branch_id ?? null, count };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const total = ranked.reduce((sum, row) => sum + row.count, 0);
  return ranked.map((row) => ({ ...row, share: total > 0 ? Math.round((row.count / total) * 100) : 0 }));
}

export function buildProblems(input: {
  services: DashboardService[];
  period: DashboardPeriod;
  now: Date;
}): DashboardProblem[] {
  const { services, period, now } = input;
  const start = periodStart(period, now);
  const counts = new Map<string, number>();
  for (const service of services) {
    const created = new Date(service.created_at).getTime();
    if (Number.isNaN(created) || created < start || created > now.getTime()) continue;
    for (const raw of service.kerusakan ?? []) {
      const problem = raw.trim();
      if (!problem) continue;
      counts.set(problem, (counts.get(problem) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([problem, count]) => ({ problem, count, change: null }))
    .sort((a, b) => b.count - a.count || a.problem.localeCompare(b.problem));
}

export function buildBranches(input: {
  finance: DashboardFinance[];
  branches: { id: string; name: string }[];
  period: DashboardPeriod;
  now: Date;
}): DashboardBranch[] {
  const { finance, branches, period, now } = input;
  const start = periodStart(period, now);
  const totals = new Map<string, number>();
  for (const entry of finance) {
    if (entry.type !== "pemasukan") continue;
    if (!financeDateInRange(entry.kas_date, start, now)) continue;
    totals.set(entry.branch_id, (totals.get(entry.branch_id) ?? 0) + Number(entry.amount ?? 0));
  }
  const namesById = new Map(branches.map((branch) => [branch.id, branch.name]));
  return Array.from(totals.entries())
    .map(([id, pendapatan]) => ({ id, name: namesById.get(id) ?? "—", pendapatan }))
    .sort((a, b) => b.pendapatan - a.pendapatan);
}

export function buildRecentActivity(input: {
  services: DashboardService[];
  customers: { id: string; name: string }[];
  limit: number;
}): DashboardActivity[] {
  const { services, customers, limit } = input;
  const namesById = new Map(customers.map((customer) => [customer.id, customer.name]));
  return [...services]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, Math.max(0, limit))
    .map((service) => ({
      id: service.id,
      device: service.device,
      status: service.status,
      customer: (service.customer_id ? namesById.get(service.customer_id) : null) ?? "Tanpa nama",
      createdAt: service.created_at,
    }));
}
