export type TechnicianInput = {
  profile_id: string;
  full_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
};

export type ServiceForTech = {
  teknisi_id: string | null;
  status: string;
  price: number | null;
};

export type BranchIntensif = {
  is_intensif_enabled: boolean;
  intensif_mode: string;
  intensif_value: number | null;
  intensif_target_count: number | null;
};

export type TeknisiPerformanceRow = {
  id: string;
  name: string;
  initials: string;
  branchId: string | null;
  branchName: string;
  total: number;
  selesai: number;
  batal: number;
  pending: number;
  revenue: number;
  /** Nothing in the schema records technician ratings, so this is always null. */
  rating: null;
  intensifEnabled: boolean;
  intensifMode: "percent" | "fixed";
  intensifValue: number;
  intensifTarget: number | null;
  insentif: number;
  targetPct: number;
};

export type PerformaTeknisi = {
  rows: TeknisiPerformanceRow[];
  summary: { technicians: number; selesai: number; revenue: number; insentif: number };
};

const NO_VALUE = "—";
const DONE = new Set(["Selesai", "Sudah Diambil"]);

function amount(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
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

export function buildPerformaTeknisi(input: {
  technicians: TechnicianInput[];
  services: ServiceForTech[];
  branchIntensif: Record<string, BranchIntensif>;
  now: Date;
}): PerformaTeknisi {
  const { technicians, services, branchIntensif } = input;

  const totals = new Map<string, { total: number; selesai: number; batal: number; pending: number; revenue: number }>();
  for (const technician of technicians) {
    totals.set(technician.profile_id, { total: 0, selesai: 0, batal: 0, pending: 0, revenue: 0 });
  }

  for (const service of services) {
    if (!service.teknisi_id) continue;
    const bucket = totals.get(service.teknisi_id);
    if (!bucket) continue;
    bucket.total += 1;
    if (DONE.has(service.status)) {
      bucket.selesai += 1;
      bucket.revenue += amount(service.price);
    } else if (service.status === "Batal") {
      bucket.batal += 1;
    } else {
      bucket.pending += 1;
    }
  }

  const rows: TeknisiPerformanceRow[] = technicians.map((technician) => {
    const counts = totals.get(technician.profile_id) ?? { total: 0, selesai: 0, batal: 0, pending: 0, revenue: 0 };
    const setting = technician.branch_id ? branchIntensif[technician.branch_id] : undefined;
    const enabled = Boolean(setting?.is_intensif_enabled);
    const mode: "percent" | "fixed" = setting?.intensif_mode === "fixed" ? "fixed" : "percent";
    const value = amount(setting?.intensif_value);
    const target = setting?.intensif_target_count ?? null;

    // Percent mode is a share of the revenue actually recorded for finished
    // services, not an assumed average ticket.
    const insentif = enabled
      ? mode === "fixed"
        ? counts.selesai * value
        : Math.round((counts.revenue * value) / 100)
      : 0;

    const targetPct = enabled && target && target > 0 ? Math.min(100, Math.round((counts.selesai / target) * 100)) : 0;
    const name = technician.full_name?.trim() || "Tanpa nama";

    return {
      id: technician.profile_id,
      name,
      initials: initialsOf(name),
      branchId: technician.branch_id,
      branchName: technician.branch_name?.trim() || NO_VALUE,
      total: counts.total,
      selesai: counts.selesai,
      batal: counts.batal,
      pending: counts.pending,
      revenue: counts.revenue,
      rating: null,
      intensifEnabled: enabled,
      intensifMode: mode,
      intensifValue: value,
      intensifTarget: target,
      insentif,
      targetPct,
    };
  });

  rows.sort((a, b) => b.selesai - a.selesai || b.revenue - a.revenue || a.name.localeCompare(b.name));

  return {
    rows,
    summary: {
      technicians: rows.length,
      selesai: rows.reduce((sum, row) => sum + row.selesai, 0),
      revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
      insentif: rows.reduce((sum, row) => sum + row.insentif, 0),
    },
  };
}
