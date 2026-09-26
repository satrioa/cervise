export type FinanceTx = {
  id: string;
  amount: number;
  type: string;
  kas_date: string;
  branch_id: string | null;
  description: string | null;
  metode: string | null;
  created_at?: string | null;
};

export type PeriodRow = {
  key: string;
  masuk: number;
  keluar: number;
  net: number;
  count: number;
};

export type BranchRow = {
  branchId: string | null;
  branchName: string;
  masuk: number;
  keluar: number;
  net: number;
  count: number;
};

export type DescriptionRow = {
  name: string;
  amount: number;
  pct: number;
};

export type RecentRow = {
  id: string;
  type: string;
  amount: number;
  kasDate: string;
  description: string | null;
  metode: string | null;
  branchName: string;
};

export type LaporanKeuangan = {
  totalMasuk: number;
  totalKeluar: number;
  totalNet: number;
  transactionCount: number;
  harian: PeriodRow[];
  bulanan: PeriodRow[];
  byBranch: BranchRow[];
  byDescription: DescriptionRow[];
  monthComparison: { current: number; previous: number; changePct: number | null };
  recent: RecentRow[];
};

const NO_DESCRIPTION = "Tanpa keterangan";

function amountOf(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function previousMonthKey(date: Date): string {
  return monthKey(new Date(date.getFullYear(), date.getMonth() - 1, 1));
}

export function buildLaporanKeuangan(input: {
  transactions: FinanceTx[];
  branches: { id: string; name: string }[];
  now: Date;
}): LaporanKeuangan {
  const { transactions, branches, now } = input;
  const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));

  let totalMasuk = 0;
  let totalKeluar = 0;

  const harianMap = new Map<string, PeriodRow>();
  const bulananMap = new Map<string, PeriodRow>();
  const branchMap = new Map<string, BranchRow>();
  const descriptionMap = new Map<string, number>();

  for (const transaction of transactions) {
    const amount = amountOf(transaction.amount);
    const isIncome = transaction.type === "pemasukan";
    const isExpense = transaction.type === "pengeluaran";
    // Unknown types stay out of both totals rather than being guessed at.
    if (!isIncome && !isExpense) continue;

    if (isIncome) totalMasuk += amount;
    else totalKeluar += amount;

    const key = transaction.kas_date;
    const harian = harianMap.get(key) ?? { key, masuk: 0, keluar: 0, net: 0, count: 0 };
    harian.count += 1;
    if (isIncome) harian.masuk += amount;
    else harian.keluar += amount;
    harian.net = harian.masuk - harian.keluar;
    harianMap.set(key, harian);

    const month = key.slice(0, 7);
    const bulanan = bulananMap.get(month) ?? { key: month, masuk: 0, keluar: 0, net: 0, count: 0 };
    bulanan.count += 1;
    if (isIncome) bulanan.masuk += amount;
    else bulanan.keluar += amount;
    bulanan.net = bulanan.masuk - bulanan.keluar;
    bulananMap.set(month, bulanan);

    const branchKey = transaction.branch_id ?? "—";
    const branch = branchMap.get(branchKey) ?? {
      branchId: transaction.branch_id,
      branchName: transaction.branch_id ? (branchNames.get(transaction.branch_id) ?? "—") : "Tanpa cabang",
      masuk: 0,
      keluar: 0,
      net: 0,
      count: 0,
    };
    branch.count += 1;
    if (isIncome) branch.masuk += amount;
    else branch.keluar += amount;
    branch.net = branch.masuk - branch.keluar;
    branchMap.set(branchKey, branch);

    if (isIncome) {
      const name = transaction.description?.trim() || NO_DESCRIPTION;
      descriptionMap.set(name, (descriptionMap.get(name) ?? 0) + amount);
    }
  }

  const byDescription: DescriptionRow[] =
    totalMasuk > 0
      ? Array.from(descriptionMap.entries())
          .map(([name, amount]) => ({ name, amount, pct: Math.round((amount / totalMasuk) * 100) }))
          .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
      : [];

  const currentMonth = monthKey(now);
  const previousMonth = previousMonthKey(now);
  const current = bulananMap.get(currentMonth)?.masuk ?? 0;
  const previous = bulananMap.get(previousMonth)?.masuk ?? 0;

  const recent: RecentRow[] = [...transactions]
    .sort((a, b) => (a.kas_date < b.kas_date ? 1 : a.kas_date > b.kas_date ? -1 : 0))
    .slice(0, 5)
    .map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amount: amountOf(transaction.amount),
      kasDate: transaction.kas_date,
      description: transaction.description,
      metode: transaction.metode,
      branchName: transaction.branch_id ? (branchNames.get(transaction.branch_id) ?? "—") : "Tanpa cabang",
    }));

  return {
    totalMasuk,
    totalKeluar,
    totalNet: totalMasuk - totalKeluar,
    transactionCount: transactions.length,
    harian: Array.from(harianMap.values()).sort((a, b) => (a.key < b.key ? -1 : 1)),
    bulanan: Array.from(bulananMap.values()).sort((a, b) => (a.key < b.key ? -1 : 1)),
    byBranch: Array.from(branchMap.values()).sort((a, b) => b.masuk - a.masuk || b.keluar - a.keluar),
    byDescription,
    monthComparison: {
      current,
      previous,
      // No honest percentage exists when the previous month has no income.
      changePct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
    },
    recent,
  };
}
