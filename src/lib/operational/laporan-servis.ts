import { toLocalDateString } from "./garansi-list";

export type ServisReportInput = {
  id: string;
  service_number: string | null;
  created_at: string;
  branch_id: string;
  teknisi_id: string | null;
  status: string;
  price: number | null;
  device: string | null;
};

export type ServisDetailRow = {
  id: string;
  serviceLabel: string;
  device: string;
  status: string;
  price: number;
  createdAt: string;
  teknisi: string;
  branchName: string;
};

export type ServisPeriodGroup = {
  key: string;
  total: number;
  selesai: number;
  batal: number;
  pending: number;
  net: number;
  services: ServisDetailRow[];
};

export type LaporanServis = {
  harian: ServisPeriodGroup[];
  bulanan: ServisPeriodGroup[];
  services: ServisDetailRow[];
  summary: { total: number; selesai: number; batal: number; pending: number; net: number };
};

const DONE = new Set(["Selesai", "Sudah Diambil"]);

function classify(status: string): "selesai" | "batal" | "pending" {
  if (DONE.has(status)) return "selesai";
  if (status === "Batal") return "batal";
  return "pending";
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function bucket(map: Map<string, ServisPeriodGroup>, key: string): ServisPeriodGroup {
  const existing = map.get(key);
  if (existing) return existing;
  const created: ServisPeriodGroup = { key, total: 0, selesai: 0, batal: 0, pending: 0, net: 0, services: [] };
  map.set(key, created);
  return created;
}

function toDetail(
  service: ServisReportInput,
  branchNames: Map<string, string>,
  technicianNames: Map<string, string>,
): ServisDetailRow {
  const price = Number(service.price ?? 0);
  return {
    id: service.id,
    serviceLabel: service.service_number?.trim() || shortId(service.id),
    device: service.device ?? "—",
    status: service.status,
    price: Number.isFinite(price) ? price : 0,
    createdAt: service.created_at,
    teknisi: service.teknisi_id ? (technicianNames.get(service.teknisi_id) ?? "Tanpa teknisi") : "Tanpa teknisi",
    branchName: branchNames.get(service.branch_id) ?? "—",
  };
}

export function buildLaporanServis(input: {
  services: ServisReportInput[];
  branches: { id: string; name: string }[];
  technicians: { id: string; full_name: string | null }[];
  now: Date;
}): LaporanServis {
  const { services, branches, technicians } = input;
  const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
  const technicianNames = new Map(
    technicians
      .filter((technician) => technician.full_name?.trim())
      .map((technician) => [technician.id, technician.full_name!.trim()]),
  );

  const harianMap = new Map<string, ServisPeriodGroup>();
  const bulananMap = new Map<string, ServisPeriodGroup>();
  const details: ServisDetailRow[] = [];
  const summary = { total: 0, selesai: 0, batal: 0, pending: 0, net: 0 };

  for (const service of services) {
    const created = new Date(service.created_at);
    if (Number.isNaN(created.getTime())) continue;

    const detail = toDetail(service, branchNames, technicianNames);
    details.push(detail);

    const kind = classify(service.status);
    summary.total += 1;
    summary[kind] += 1;
    summary.net += detail.price;

    // Local calendar grouping, so a late-evening service is not filed under
    // tomorrow because of the UTC offset.
    const dayKey = toLocalDateString(created);
    const monthKey = dayKey.slice(0, 7);

    for (const [key, map] of [[dayKey, harianMap], [monthKey, bulananMap]] as const) {
      const group = bucket(map, key);
      group.total += 1;
      group[kind] += 1;
      group.net += detail.price;
      group.services.push(detail);
    }
  }

  const newestFirst = (a: ServisPeriodGroup, b: ServisPeriodGroup) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0);

  return {
    harian: Array.from(harianMap.values()).sort(newestFirst),
    bulanan: Array.from(bulananMap.values()).sort(newestFirst),
    services: details.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)),
    summary,
  };
}
