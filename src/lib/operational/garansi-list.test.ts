import { describe, expect, it } from "vitest";
import {
  addGaransiDays,
  formatServisInvoiceNo,
  mapGaransiListRows,
  normalizeGaransiUnit,
  resolveGaransiUntil,
  toDays,
  toLocalDateString,
  type GaransiServiceInput,
} from "./garansi-list";

function service(overrides: Partial<GaransiServiceInput> = {}): GaransiServiceInput {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    device: "iPhone 13",
    status: "Selesai",
    garansi_value: 30,
    garansi_unit: "hari",
    garansi_until: null,
    created_at: "2026-09-01T08:30:00.000Z",
    customer_id: "cust-1",
    branch_id: "branch-1",
    ...overrides,
  };
}

describe("garansi date math", () => {
  it("converts warranty units to days", () => {
    expect(toDays(7, "hari")).toBe(7);
    expect(toDays(2, "bulan")).toBe(60);
    expect(toDays(1, "tahun")).toBe(365);
  });

  it("falls back to days for unknown units", () => {
    expect(normalizeGaransiUnit("minggu")).toBe("hari");
    expect(normalizeGaransiUnit(null)).toBe("hari");
    expect(normalizeGaransiUnit("tahun")).toBe("tahun");
  });

  it("adds days across a month boundary", () => {
    const result = addGaransiDays(new Date(2026, 8, 20), 30);
    expect(toLocalDateString(result)).toBe("2026-10-20");
  });
});

describe("resolveGaransiUntil", () => {
  it("prefers the stored garansi_until", () => {
    const resolved = resolveGaransiUntil({
      garansi_until: "2026-12-01T00:00:00.000Z",
      created_at: "2026-09-01T00:00:00.000Z",
      garansi_value: 1,
      garansi_unit: "bulan",
    });
    expect(resolved?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });

  it("derives the expiry when the column was never populated", () => {
    const resolved = resolveGaransiUntil({
      garansi_until: null,
      created_at: "2026-09-01T00:00:00.000Z",
      garansi_value: 3,
      garansi_unit: "bulan",
    });
    // months are fixed 30-day blocks, so 3 months = 90 days: Sep 1 + 90 = Nov 30
    expect(toLocalDateString(resolved!)).toBe("2026-11-30");
  });

  it("returns null when there is no warranty term at all", () => {
    expect(
      resolveGaransiUntil({
        garansi_until: null,
        created_at: "2026-09-01T00:00:00.000Z",
        garansi_value: 0,
        garansi_unit: "hari",
      }),
    ).toBeNull();
  });

  it("returns null for a zero or negative term", () => {
    expect(
      resolveGaransiUntil({
        garansi_until: null,
        created_at: "2026-09-01T00:00:00.000Z",
        garansi_value: -5,
        garansi_unit: "hari",
      }),
    ).toBeNull();
  });

  it("ignores an unparsable stored value and falls back to the term", () => {
    const resolved = resolveGaransiUntil({
      garansi_until: "bukan tanggal",
      created_at: "2026-09-01T00:00:00.000Z",
      garansi_value: 10,
      garansi_unit: "hari",
    });
    expect(toLocalDateString(resolved!)).toBe("2026-09-11");
  });
});

describe("formatServisInvoiceNo", () => {
  it("is stable for the same creation timestamp", () => {
    expect(formatServisInvoiceNo("2026-09-12T12:00:00", "abc")).toBe(
      formatServisInvoiceNo("2026-09-12T12:00:00", "abc"),
    );
  });

  it("falls back to the id prefix when the timestamp is invalid", () => {
    expect(formatServisInvoiceNo("not-a-date", "abcdef123456")).toBe("INV-ABCDEF12");
  });
});

describe("mapGaransiListRows", () => {
  const customers = [{ id: "cust-1", name: "Citra", phone: "0812" }];
  const branches = [{ id: "branch-1", name: "Cervise Pusat" }];

  it("joins customer and branch and derives the expiry", () => {
    const rows = mapGaransiListRows({ services: [service()], customers, branches });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      device: "iPhone 13",
      customer: { name: "Citra", phone: "0812" },
      cabang: "Cervise Pusat",
      garansiValue: 30,
      garansiUnit: "hari",
    });
    expect(rows[0].garansiUntil).not.toBeNull();
  });

  it("labels services with no customer or branch instead of dropping them", () => {
    const rows = mapGaransiListRows({
      services: [service({ customer_id: null, branch_id: "branch-missing" })],
      customers,
      branches,
    });

    expect(rows[0].customer).toEqual({ name: "Tanpa nama", phone: "—" });
    expect(rows[0].cabang).toBe("—");
  });

  it("sorts newest first", () => {
    const older = service({ id: "aaaaaaaa-0000-0000-0000-000000000000", created_at: "2026-01-01T00:00:00.000Z" });
    const newer = service({ id: "bbbbbbbb-0000-0000-0000-000000000000", created_at: "2026-06-01T00:00:00.000Z" });

    const rows = mapGaransiListRows({ services: [older, newer], customers, branches });

    expect(rows.map((row) => row.id)).toEqual([newer.id, older.id]);
  });

  it("returns an empty list for no services", () => {
    expect(mapGaransiListRows({ services: [], customers, branches })).toEqual([]);
  });
});
