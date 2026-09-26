import { describe, expect, it } from "vitest";
import {
  buildBranches,
  buildBuckets,
  buildProblems,
  buildRecentActivity,
  buildTechnicians,
  summarizeDashboard,
  type DashboardFinance,
  type DashboardService,
} from "./dashboard";

// Wednesday 2026-09-23, 15:30 local time
const NOW = new Date(2026, 8, 23, 15, 30, 0);

// Fixtures are built from local calendar parts so the assertions hold in any timezone.
const sep = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute).toISOString();
const longAgo = new Date(2026, 0, 5, 9).toISOString();
const wayBack = new Date(2025, 0, 5, 9).toISOString();
const future = new Date(2026, 11, 1).toISOString();
const past = new Date(2026, 0, 1).toISOString();

function service(overrides: Partial<DashboardService> = {}): DashboardService {
  return {
    id: "svc-1",
    device: "iPhone 13",
    status: "Selesai",
    created_at: sep(23, 9),
    updated_at: sep(23, 10),
    teknisi_id: null,
    kerusakan: [],
    garansi_value: null,
    garansi_unit: null,
    garansi_until: null,
    ...overrides,
  };
}

function finance(overrides: Partial<DashboardFinance> = {}): DashboardFinance {
  return { branch_id: "branch-1", type: "pemasukan", amount: 100, kas_date: "2026-09-23", ...overrides };
}

describe("buildBuckets", () => {
  it("returns 24 hourly buckets for today", () => {
    const buckets = buildBuckets("hari ini", NOW);
    expect(buckets).toHaveLength(24);
    expect(buckets[0].key).toBe("00:00");
    expect(buckets[23].key).toBe("23:00");
  });

  it("returns 7 daily buckets for the last week", () => {
    const buckets = buildBuckets("7d", NOW);
    expect(buckets).toHaveLength(7);
  });

  it("returns 30 daily buckets for the last month", () => {
    expect(buildBuckets("30d", NOW)).toHaveLength(30);
  });

  it("returns 12 weekly buckets for the last quarter", () => {
    expect(buildBuckets("90d", NOW)).toHaveLength(12);
  });

  it("produces contiguous, non-overlapping buckets ending now", () => {
    const buckets = buildBuckets("7d", NOW);
    expect(buckets[0].end.getTime()).toBe(buckets[1].start.getTime());
    expect(buckets[buckets.length - 1].end.getTime()).toBe(NOW.getTime());
  });

  it("covers the whole window with no gap", () => {
    const buckets = buildBuckets("hari ini", NOW);
    expect(buckets[0].start.getHours()).toBe(0);
    expect(buckets[0].start.getMinutes()).toBe(0);
  });
});

describe("summarizeDashboard", () => {
  it("reports zeroes rather than inventing values for an empty branch", () => {
    const result = summarizeDashboard({ services: [], finance: [], period: "30d", now: NOW });

    expect(result.totalServis).toBe(0);
    expect(result.pendingKonfirmasi).toBe(0);
    expect(result.omzet).toBe(0);
    expect(result.pengeluaran).toBe(0);
    expect(result.garansiAktif).toBe(0);
    expect(result.bucketTotal).toBe(0);
  });

  it("counts services created inside the period only", () => {
    const result = summarizeDashboard({
      services: [
        service({ id: "in", created_at: sep(23, 9) }),
        service({ id: "old", created_at: longAgo }),
      ],
      finance: [],
      period: "30d",
      now: NOW,
    });

    expect(result.totalServis).toBe(1);
  });

  it("keeps a genuine zero-revenue day at zero", () => {
    const result = summarizeDashboard({
      services: [],
      finance: [finance({ type: "pemasukan", amount: 0 })],
      period: "hari ini",
      now: NOW,
    });

    expect(result.omzet).toBe(0);
  });

  it("separates income from spending", () => {
    const result = summarizeDashboard({
      services: [],
      finance: [
        finance({ type: "pemasukan", amount: 500_000 }),
        finance({ type: "pemasukan", amount: 250_000 }),
        finance({ type: "pengeluaran", amount: 100_000 }),
      ],
      period: "hari ini",
      now: NOW,
    });

    expect(result.omzet).toBe(750_000);
    expect(result.pengeluaran).toBe(100_000);
  });

  it("excludes finance dated outside the period", () => {
    const result = summarizeDashboard({
      services: [],
      finance: [finance({ amount: 999, kas_date: "2026-01-01" })],
      period: "30d",
      now: NOW,
    });

    expect(result.omzet).toBe(0);
  });

  it("counts pending confirmation as current state, not period state", () => {
    const result = summarizeDashboard({
      services: [
        service({ id: "old", status: "Menunggu Konfirmasi", created_at: longAgo }),
        service({ id: "new", status: "Menunggu Konfirmasi", created_at: sep(23, 9) }),
        service({ id: "done", status: "Selesai" }),
      ],
      finance: [],
      period: "30d",
      now: NOW,
    });

    expect(result.pendingKonfirmasi).toBe(2);
  });

  it("counts warranties that have not expired yet", () => {
    const result = summarizeDashboard({
      services: [
        service({ id: "live", garansi_until: future }),
        service({ id: "dead", garansi_until: past }),
        service({ id: "none", garansi_until: null, garansi_value: null }),
      ],
      finance: [],
      period: "30d",
      now: NOW,
    });

    expect(result.garansiAktif).toBe(1);
  });

  it("derives an active warranty when only the term was stored", () => {
    const result = summarizeDashboard({
      services: [
        service({ id: "derived", garansi_until: null, garansi_value: 90, garansi_unit: "hari", created_at: sep(20, 9) }),
      ],
      finance: [],
      period: "30d",
      now: NOW,
    });

    expect(result.garansiAktif).toBe(1);
  });

  it("distributes arrivals into the right bucket", () => {
    const result = summarizeDashboard({
      services: [
        service({ id: "a", created_at: sep(23, 9) }),
        service({ id: "b", created_at: sep(23, 11) }),
      ],
      finance: [],
      period: "hari ini",
      now: NOW,
    });

    expect(result.buckets[9].masuk).toBe(1);
    expect(result.buckets[11].masuk).toBe(1);
    expect(result.bucketTotal).toBe(2);
  });

  it("tracks picked-up and cancelled series from the last update", () => {
    const result = summarizeDashboard({
      services: [
        service({ id: "done", status: "Sudah Diambil", updated_at: sep(23, 9) }),
        service({ id: "cancel", status: "Batal", updated_at: sep(23, 10) }),
      ],
      finance: [],
      period: "hari ini",
      now: NOW,
    });

    expect(result.buckets[9].diambil).toBe(1);
    expect(result.buckets[10].batal).toBe(1);
  });

  it("always returns one bucket per period slot even with no data", () => {
    const result = summarizeDashboard({ services: [], finance: [], period: "90d", now: NOW });
    expect(result.buckets).toHaveLength(12);
    expect(result.buckets.every((bucket) => bucket.masuk === 0)).toBe(true);
  });
});

describe("buildTechnicians", () => {
  it("ranks technicians by services handled, newest period only", () => {
    const result = buildTechnicians({
      services: [
        service({ id: "1", teknisi_id: "t-rudi", created_at: sep(23, 9) }),
        service({ id: "2", teknisi_id: "t-rudi", created_at: sep(22, 9) }),
        service({ id: "3", teknisi_id: "t-sari", created_at: sep(23, 9) }),
        service({ id: "4", teknisi_id: "t-rudi", created_at: "2026-01-01T09:00:00.000Z" }),
      ],
      profiles: [
        { id: "t-rudi", full_name: "Rudi", branch_id: "branch-1" },
        { id: "t-sari", full_name: "Sari", branch_id: "branch-1" },
      ],
      period: "30d",
      now: NOW,
    });

    expect(result[0]).toMatchObject({ name: "Rudi", count: 2 });
    expect(result[1]).toMatchObject({ name: "Sari", count: 1 });
  });

  it("computes a share that sums to 100 across listed technicians", () => {
    const result = buildTechnicians({
      services: [
        service({ id: "1", teknisi_id: "t-a", created_at: sep(23, 9) }),
        service({ id: "2", teknisi_id: "t-a", created_at: sep(23, 9) }),
        service({ id: "3", teknisi_id: "t-b", created_at: sep(23, 9) }),
      ],
      profiles: [
        { id: "t-a", full_name: "A", branch_id: "branch-1" },
        { id: "t-b", full_name: "B", branch_id: "branch-1" },
      ],
      period: "30d",
      now: NOW,
    });

    expect(result.reduce((total, row) => total + row.share, 0)).toBe(100);
  });

  it("labels a technician with no profile instead of dropping the work", () => {
    const result = buildTechnisiForMissingProfile();
    expect(result[0]).toMatchObject({ name: "Tanpa nama", count: 1 });
  });

  it("returns an empty list when nothing is assigned", () => {
    const result = buildTechnicians({
      services: [service({ teknisi_id: null, created_at: sep(23, 9) })],
      profiles: [],
      period: "30d",
      now: NOW,
    });

    expect(result).toEqual([]);
  });
});

function buildTechnisiForMissingProfile() {
  return buildTechnicians({
    services: [service({ teknisi_id: "ghost", created_at: sep(23, 9) })],
    profiles: [],
    period: "30d",
    now: NOW,
  });
}

describe("buildProblems", () => {
  it("counts the most common complaint tags in the period", () => {
    const result = buildProblems({
      services: [
        service({ id: "1", kerusakan: ["Layar retak", "Baterai drop"], created_at: sep(23, 9) }),
        service({ id: "2", kerusakan: ["Layar retak"], created_at: sep(22, 9) }),
        service({ id: "3", kerusakan: ["Mati total"], created_at: sep(21, 9) }),
        service({ id: "4", kerusakan: ["Layar retak"], created_at: wayBack }),
      ],
      period: "30d",
      now: NOW,
    });

    expect(result[0]).toMatchObject({ problem: "Layar retak", count: 2 });
    expect(result.map((row) => row.problem)).toEqual(["Layar retak", "Baterai drop", "Mati total"]);
  });

  it("ignores services with no recorded complaint", () => {
    const result = buildProblems({
      services: [service({ kerusakan: null, created_at: sep(23, 9) })],
      period: "30d",
      now: NOW,
    });

    expect(result).toEqual([]);
  });

  it("does not emit a fake percentage change", () => {
    const result = buildProblems({
      services: [service({ kerusakan: ["Layar retak"], created_at: sep(23, 9) })],
      period: "30d",
      now: NOW,
    });

    expect(result[0].change).toBeNull();
  });
});

describe("buildBranches", () => {
  it("sums income per branch inside the period", () => {
    const result = buildBranches({
      finance: [
        finance({ branch_id: "b1", amount: 100_000 }),
        finance({ branch_id: "b1", amount: 50_000 }),
        finance({ branch_id: "b2", amount: 20_000 }),
        finance({ branch_id: "b1", type: "pengeluaran", amount: 999_999 }),
      ],
      branches: [
        { id: "b1", name: "Pusat" },
        { id: "b2", name: "Cabang 2" },
      ],
      period: "30d",
      now: NOW,
    });

    expect(result[0]).toMatchObject({ name: "Pusat", pendapatan: 150_000 });
    expect(result[1]).toMatchObject({ name: "Cabang 2", pendapatan: 20_000 });
  });

  it("labels a branch that is not in the lookup", () => {
    const result = buildBranches({
      finance: [finance({ branch_id: "ghost", amount: 10 })],
      branches: [],
      period: "30d",
      now: NOW,
    });

    expect(result[0].name).toBe("—");
  });

  it("returns nothing when there is no finance activity", () => {
    expect(buildBranches({ finance: [], branches: [{ id: "b1", name: "Pusat" }], period: "30d", now: NOW })).toEqual([]);
  });
});

describe("buildRecentActivity", () => {
  it("returns the newest services first, capped at the limit", () => {
    const result = buildRecentActivity({
      services: [
        service({ id: "old", device: "Old", created_at: sep(20, 9) }),
        service({ id: "new", device: "New", created_at: sep(23, 9) }),
      ],
      customers: [],
      limit: 1,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("new");
  });

  it("falls back to a placeholder when the customer is unknown", () => {
    const result = buildRecentActivity({
      services: [service({ customer_id: "ghost" })],
      customers: [],
      limit: 5,
    });

    expect(result[0].customer).toBe("Tanpa nama");
  });

  it("includes the known customer name", () => {
    const result = buildRecentActivity({
      services: [service({ customer_id: "c1" })],
      customers: [{ id: "c1", name: "Citra" }],
      limit: 5,
    });

    expect(result[0].customer).toBe("Citra");
  });
});
