import type { MetricPoint } from "@/components/kokonutui/metric-card";
import type { UptimeService } from "@/components/kokonutui/uptime-card";

export const REVENUE_SEGMENTS = ["Renewal", "Initial", "Upgrade"] as const;
export const WA_SEGMENTS = ["Customer", "Teknisi"] as const;
export const UPTIME_SERVICES = ["API", "WhatsApp", "Database", "Dashboard"] as const;

/** Baris update insiden: `HH:MM|Label|Catatan opsional`. */
export function parseIncidentUpdates(
  value: string,
): { time: string; label: string; note?: string }[] | null {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const updates: { time: string; label: string; note?: string }[] = [];
  for (const line of lines) {
    const [time = "", label = "", note = ""] = line.split("|").map((part) => part.trim());
    if (!/^\d{2}:\d{2}$/.test(time) || !label) return null;
    updates.push(note ? { time, label, note } : { time, label });
  }
  return updates;
}

export type OwnerIncident = {
  occurred_on: string;
  service: string;
  status: string;
  minutes: number;
  title: string;
  updates: { time: string; label: string; note?: string }[];
};

function isoDay(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function windowDays(days: number, now: Date): string[] {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, index) =>
    new Date(end - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10),
  );
}

export function revenueSeries(
  invoices: { status: string; amount: number; period_start: string | null; invoice_type: string | null }[],
  days = 180,
  now = new Date(),
): MetricPoint[] {
  const dates = windowDays(days, now);
  const points = new Map(dates.map((date) => [date, { date, parts: [0, 0, 0] }]));
  for (const invoice of invoices) {
    if (invoice.status !== "approved" || !invoice.period_start) continue;
    const date = isoDay(invoice.period_start);
    const point = points.get(date);
    if (!point) continue;
    const index = invoice.invoice_type === "renewal" ? 0 : invoice.invoice_type === "upgrade" ? 2 : 1;
    point.parts[index] += Number(invoice.amount ?? 0);
  }
  return dates.map((date) => points.get(date)!);
}

export function waSeries(
  rows: { created_at: string; to_kind: string | null; state: string }[],
  days = 180,
  now = new Date(),
): MetricPoint[] {
  const dates = windowDays(days, now);
  const points = new Map(dates.map((date) => [date, { date, parts: [0, 0] }]));
  for (const row of rows) {
    if (row.state !== "sent") continue;
    const point = points.get(isoDay(row.created_at));
    if (!point) continue;
    point.parts[row.to_kind === "technician" ? 1 : 0] += 1;
  }
  return dates.map((date) => points.get(date)!);
}

export function waTotals(rows: { state: string }[]) {
  return {
    sent: rows.filter((row) => row.state === "sent").length,
    failed: rows.filter((row) => row.state === "failed").length,
    skipped: rows.filter((row) => row.state === "skipped").length,
  };
}

export function incidentServices(
  incidents: OwnerIncident[],
  days = 90,
  now = new Date(),
): UptimeService[] {
  const dates = windowDays(days, now);
  const indexOf = new Map(dates.map((date, index) => [date, index]));
  return UPTIME_SERVICES.map((name) => {
    const mapped: UptimeService["incidents"] = {};
    for (const incident of incidents) {
      const index = indexOf.get(isoDay(incident.occurred_on));
      if (index === undefined || incident.service !== name) continue;
      mapped[index] = {
        title: incident.title,
        status: incident.status === "down" ? "down" : "degraded",
        minutes: Number(incident.minutes),
        updates: incident.updates ?? [],
      };
    }
    return { name, incidents: mapped };
  });
}
