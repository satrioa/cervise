export type SaleInput = {
  id: string;
  sale_number: string | null;
  kas_date: string;
  subtotal: number | null;
  discount_total: number | null;
  total: number | null;
  paid: number | null;
  payment_status: string | null;
  payment_method: string | null;
  branch_id: string | null;
};

export type SaleDetailRow = {
  id: string;
  label: string;
  kasDate: string;
  total: number;
  paid: number;
  unpaid: number;
  paymentStatus: string;
  paymentMethod: string;
  branchName: string;
};

export type SalePeriodGroup = {
  key: string;
  omzet: number;
  paid: number;
  unpaid: number;
  discount: number;
  count: number;
  sales: SaleDetailRow[];
};

export type LaporanPenjualan = {
  harian: SalePeriodGroup[];
  bulanan: SalePeriodGroup[];
  sales: SaleDetailRow[];
  summary: { omzet: number; paid: number; unpaid: number; discount: number; count: number };
};

const NO_VALUE = "—";

const STATUS_LABELS: Record<string, string> = {
  lunas: "Lunas",
  belum_bayar: "Belum bayar",
};

export function paymentStatusLabel(status: string | null | undefined): string {
  if (!status) return NO_VALUE;
  return STATUS_LABELS[status] ?? status;
}

function amount(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bucket(map: Map<string, SalePeriodGroup>, key: string): SalePeriodGroup {
  const existing = map.get(key);
  if (existing) return existing;
  const created: SalePeriodGroup = { key, omzet: 0, paid: 0, unpaid: 0, discount: 0, count: 0, sales: [] };
  map.set(key, created);
  return created;
}

export function buildLaporanPenjualan(input: {
  sales: SaleInput[];
  branches: { id: string; name: string }[];
  now: Date;
}): LaporanPenjualan {
  const branchNames = new Map(input.branches.map((branch) => [branch.id, branch.name]));

  const harianMap = new Map<string, SalePeriodGroup>();
  const bulananMap = new Map<string, SalePeriodGroup>();
  const details: SaleDetailRow[] = [];
  const summary = { omzet: 0, paid: 0, unpaid: 0, discount: 0, count: 0 };

  for (const sale of input.sales) {
    const total = amount(sale.total);
    const paid = amount(sale.paid);
    // An overpaid sale must not report a negative balance.
    const unpaid = Math.max(0, total - paid);
    const discount = amount(sale.discount_total);

    const detail: SaleDetailRow = {
      id: sale.id,
      label: sale.sale_number?.trim() || String(sale.id ?? "").slice(0, 8).toUpperCase() || NO_VALUE,
      kasDate: sale.kas_date,
      total,
      paid,
      unpaid,
      paymentStatus: paymentStatusLabel(sale.payment_status),
      paymentMethod: sale.payment_method?.trim() || NO_VALUE,
      branchName: sale.branch_id ? (branchNames.get(sale.branch_id) ?? NO_VALUE) : "Tanpa cabang",
    };
    details.push(detail);

    summary.count += 1;
    summary.omzet += total;
    summary.paid += paid;
    summary.unpaid += unpaid;
    summary.discount += discount;

    const dayKey = sale.kas_date;
    const monthKey = dayKey.slice(0, 7);
    if (!dayKey) continue;

    for (const [key, map] of [
      [dayKey, harianMap],
      [monthKey, bulananMap],
    ] as const) {
      const group = bucket(map, key);
      group.count += 1;
      group.omzet += total;
      group.paid += paid;
      group.unpaid += unpaid;
      group.discount += discount;
      group.sales.push(detail);
    }
  }

  const newestFirst = (a: SalePeriodGroup, b: SalePeriodGroup) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0);

  return {
    harian: Array.from(harianMap.values()).sort(newestFirst),
    bulanan: Array.from(bulananMap.values()).sort(newestFirst),
    sales: details.sort((a, b) => (a.kasDate < b.kasDate ? 1 : a.kasDate > b.kasDate ? -1 : 0)),
    summary,
  };
}
