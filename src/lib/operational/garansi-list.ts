export type GaransiUnit = "hari" | "bulan" | "tahun";

export type GaransiServiceInput = {
  id: string;
  device: string;
  status: string;
  garansi_value: number | null;
  garansi_unit: string | null;
  garansi_until: string | null;
  created_at: string;
  customer_id: string | null;
  branch_id: string;
};

export type GaransiListRow = {
  id: string;
  invoiceNo: string;
  createdAt: string;
  garansiUntil: string | null;
  garansiValue: number;
  garansiUnit: GaransiUnit;
  customer: { name: string; phone: string };
  device: string;
  cabang: string;
  status: string;
};

export function toDays(value: number, unit: string): number {
  if (unit === "bulan") return value * 30;
  if (unit === "tahun") return value * 365;
  return value;
}

/** Local calendar date, so the UI never shows a day off because of the UTC offset. */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addGaransiDays(from: Date, days: number): Date {
  const result = new Date(from.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

export function normalizeGaransiUnit(unit: string | null | undefined): GaransiUnit {
  return unit === "bulan" || unit === "tahun" ? unit : "hari";
}

/**
 * Effective warranty expiry. `garansi_until` wins when present; otherwise it is
 * derived from the warranty term and the service creation date, because rows
 * written before the column was populated only carry value + unit.
 */
export function resolveGaransiUntil(service: {
  garansi_until: string | null;
  created_at: string;
  garansi_value: number | null;
  garansi_unit: string | null;
}): Date | null {
  if (service.garansi_until) {
    const parsed = new Date(service.garansi_until);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const value = Number(service.garansi_value ?? 0);
  if (!Number.isFinite(value) || value <= 0) return null;
  const created = new Date(service.created_at);
  if (Number.isNaN(created.getTime())) return null;
  return addGaransiDays(created, toDays(value, normalizeGaransiUnit(service.garansi_unit)));
}

/** Same shape the service detail view uses, so both pages agree on an invoice number. */
export function formatServisInvoiceNo(createdAt: string, fallbackId: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return `INV-${fallbackId.slice(0, 8).toUpperCase()}`;
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = [
    pad(date.getDate()),
    pad(date.getMonth() + 1),
    String(date.getFullYear()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
  return `INV-${stamp}`;
}

export function mapGaransiListRows(input: {
  services: GaransiServiceInput[];
  customers: { id: string; name: string; phone: string | null }[];
  branches: { id: string; name: string }[];
}): GaransiListRow[] {
  const customers = new Map(input.customers.map((customer) => [customer.id, customer]));
  const branches = new Map(input.branches.map((branch) => [branch.id, branch.name]));

  return input.services
    .map((service) => {
      const customer = service.customer_id ? customers.get(service.customer_id) : null;
      const until = resolveGaransiUntil(service);
      return {
        id: service.id,
        invoiceNo: formatServisInvoiceNo(service.created_at, service.id),
        createdAt: toLocalDateString(new Date(service.created_at)),
        garansiUntil: until ? toLocalDateString(until) : null,
        garansiValue: Number(service.garansi_value ?? 0),
        garansiUnit: normalizeGaransiUnit(service.garansi_unit),
        customer: { name: customer?.name ?? "Tanpa nama", phone: customer?.phone ?? "—" },
        device: service.device,
        cabang: branches.get(service.branch_id) ?? "—",
        status: service.status,
      } satisfies GaransiListRow;
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}
