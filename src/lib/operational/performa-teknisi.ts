import { dalamRentangBulan } from "./periode-bulan";

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
  completed_at: string | null;
};

export type IntensifMode = "percent" | "fixed" | "flat";

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
  intensifMode: IntensifMode;
  intensifValue: number;
  intensifTarget: number | null;
  insentif: number;
  targetPct: number;
  selesaiTanpaTanggal: number;
};

export type PerformaTeknisi = {
  rows: TeknisiPerformanceRow[];
  summary: { technicians: number; selesai: number; revenue: number; insentif: number; selesaiTanpaTanggal: number };
};

const NO_VALUE = "—";
const DONE = new Set(["Selesai", "Sudah Diambil"]);

function amount(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readMode(value: string | null | undefined): IntensifMode {
  if (value === "fixed" || value === "flat") return value;
  return "percent";
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
  const { technicians, services, branchIntensif, now } = input;

  const totals = new Map<string, { total: number; selesai: number; batal: number; pending: number; revenue: number; tanpaTanggal: number }>();
  for (const technician of technicians) {
    totals.set(technician.profile_id, { total: 0, selesai: 0, batal: 0, pending: 0, revenue: 0, tanpaTanggal: 0 });
  }

  const kosong = { total: 0, selesai: 0, batal: 0, pending: 0, revenue: 0, tanpaTanggal: 0 };

  for (const service of services) {
    if (!service.teknisi_id) continue;
    const bucket = totals.get(service.teknisi_id);
    if (!bucket) continue;

    if (DONE.has(service.status)) {
      if (service.completed_at && dalamRentangBulan(service.completed_at, now)) {
        bucket.total += 1;
        bucket.selesai += 1;
        bucket.revenue += amount(service.price);
      } else if (!service.completed_at) {
        bucket.tanpaTanggal += 1;
      }
      continue;
    }

    bucket.total += 1;
    if (service.status === "Batal") bucket.batal += 1;
    else bucket.pending += 1;
  }

  const rows: TeknisiPerformanceRow[] = technicians.map((technician) => {
    const counts = totals.get(technician.profile_id) ?? kosong;
    const setting = technician.branch_id ? branchIntensif[technician.branch_id] : undefined;
    const enabled = Boolean(setting?.is_intensif_enabled);
    const mode = readMode(setting?.intensif_mode);
    const value = amount(setting?.intensif_value);
    const target = setting?.intensif_target_count ?? null;
    // Target adalah syarat pembayaran mode flat. Cabang percent/fixed tidak
    // punya target; bila ada sisa dari data lama, jangan dipakai untuk progres
    // -- kalau tidak, laporan menampilkan progress bar sementara dashboard
    // teknisi mengatakan target tidak berlaku.
    const hasTarget = mode === "flat" && target !== null && target > 0;

    let insentif = 0;
    if (enabled) {
      if (mode === "flat") insentif = hasTarget && counts.selesai >= (target as number) ? value : 0;
      else if (mode === "fixed") insentif = counts.selesai * value;
      else insentif = Math.round((counts.revenue * value) / 100);
    }

    const targetPct = enabled && hasTarget ? Math.min(100, Math.round((counts.selesai / (target as number)) * 100)) : 0;
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
      intensifTarget: hasTarget ? target : null,
      insentif,
      targetPct,
      selesaiTanpaTanggal: counts.tanpaTanggal,
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
      selesaiTanpaTanggal: rows.reduce((sum, row) => sum + row.selesaiTanpaTanggal, 0),
    },
  };
}
