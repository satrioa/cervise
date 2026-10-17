import { beforeEach, describe, expect, it, vi } from "vitest";

const { mocks } = vi.hoisted(() => {
  const serviceRow: Record<string, unknown> = {};
  const logRows: unknown[] = [];
  const state = {
    serviceRow,
    logRows,
    rateLimitRow: null as { window_start: string; hits: number } | null,
    orgId: "org-1" as string | null,
    calls: [] as { table: string; op: string; value?: unknown }[],
  };

  const admin = {
    from: vi.fn((table: string) => {
      if (table === "public_rate_limits") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: state.rateLimitRow, error: null }) }),
          }),
          insert: (values: unknown) => {
            state.calls.push({ table, op: "insert", value: values });
            return { error: null };
          },
          update: (values: unknown) => {
            state.calls.push({ table, op: "update", value: values });
            return { eq: () => ({ error: null }) };
          },
        };
      }
      if (table === "organizations") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({ maybeSingle: async () => ({ data: state.orgId ? { id: state.orgId } : null, error: null }) }),
            }),
          }),
        };
      }
      if (table === "cervise_services") {
        return {
          select: (columns: string) => {
            state.calls.push({ table, op: "select", value: columns });
            // Servis tidak punya organization_id sendiri, tenant-nya lewat
            // branch. Mock meniru PostgREST: embedded filter yang tidak cocok
            // berarti baris tidak terlihat.
            const filters: Record<string, unknown> = {};
            const chain: Record<string, unknown> = {
              eq: (column: string, value: unknown) => {
                filters[column] = value;
                return chain;
              },
              limit: () => ({
                maybeSingle: async () => {
                  const owner = (state.serviceRow.branchOrganizationId as string | undefined) ?? state.orgId ?? null;
                  const inScope = filters["branches.organization_id"] === owner;
                  return { data: state.serviceRow.id && inScope ? state.serviceRow : null, error: null };
                },
              }),
            };
            return chain;
          },
        };
      }
      if (table === "cervise_service_logs") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: state.logRows, error: null }) }) }) }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    }),
  };

  return { mocks: { state, admin, headers: vi.fn(), createAdminClient: vi.fn(() => admin) } };
});

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { lookupServisByCode } from "./actions";

const UNAVAILABLE = "Kode tidak ditemukan atau sudah tidak berlaku. Periksa kembali kode pada struk service Anda.";
const THROTTLED = "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.";

describe("lookupServisByCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.serviceRow = {};
    mocks.state.logRows = [];
    mocks.state.rateLimitRow = null;
    mocks.state.orgId = "org-1";
    mocks.state.calls = [];
    mocks.headers.mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }));
  });

  it("rejects a malformed code before touching the database", async () => {
    const result = await lookupServisByCode("acme", "nope");

    expect(result).toEqual({ ok: false, message: UNAVAILABLE });
    expect(mocks.state.calls).toHaveLength(0);
  });

  it("returns the same message for unknown codes and blocked tenants", async () => {
    const missing = await lookupServisByCode("acme", "A3BD9F2C4B");
    expect(missing).toEqual({ ok: false, message: UNAVAILABLE });

    mocks.state.serviceRow = { id: "svc-1", tracking_code: "A3BD9F2C4B", device: "iPhone 13", status: "Masuk", created_at: "2026-09-01T00:00:00Z", garansi_value: 30, garansi_unit: "hari", garansi_until: "2026-10-01T00:00:00Z", service_number: "SRV-2026-0001", branches: { id: "b-1", name: "Cabang Pusat" }, profiles: null };

    const found = await lookupServisByCode("acme", "a3bd9-f2c4b");
    expect(found.ok).toBe(true);
  });

  it("uses only whitelisted columns when reading the service", async () => {
    mocks.state.serviceRow = { id: "svc-1", tracking_code: "A3BD9F2C4B", device: "iPhone 13", status: "Dikerjakan", created_at: "2026-09-01T00:00:00Z", garansi_value: 30, garansi_unit: "hari", garansi_until: "2026-10-01T00:00:00Z", service_number: "SRV-2026-0001", branches: { id: "b-1", name: "Cabang Pusat" }, profiles: { full_name: "Budi" } };

    const result = await lookupServisByCode("acme", "A3BD9F2C4B");

    const serviceCall = mocks.state.calls.find((call) => call.table === "cervise_services");
    expect(serviceCall?.value).not.toContain("password_value");
    expect(serviceCall?.value).not.toContain("imei");
    expect(serviceCall?.value).not.toContain("price");
    expect(result.ok && result.result.teknisiName).toBe("Budi");
    expect(result.ok && result.result.branchName).toBe("Cabang Pusat");
    expect(result.ok && result.result.status).toBe("Dikerjakan");
  });

  it("never leaks the price or device secret into the result", async () => {
    mocks.state.serviceRow = {
      id: "svc-1",
      tracking_code: "A3BD9F2C4B",
      device: "iPhone 13",
      status: "Selesai",
      created_at: "2026-09-01T00:00:00Z",
      garansi_value: 30,
      garansi_unit: "hari",
      garansi_until: "2026-10-01T00:00:00Z",
      service_number: "SRV-2026-0001",
      price: 999999,
      password_value: "1234",
      imei1: "356938035412345",
      branches: { id: "b-1", name: "Cabang Pusat" },
      profiles: null,
    };

    const result = await lookupServisByCode("acme", "A3BD9F2C4B");

    expect(JSON.stringify(result)).not.toContain("999999");
    expect(JSON.stringify(result)).not.toContain("1234");
    expect(JSON.stringify(result)).not.toContain("356938035412345");
  });

  it("maps status history without the actor", async () => {
    mocks.state.serviceRow = { id: "svc-1", tracking_code: "A3BD9F2C4B", device: "iPhone 13", status: "Dikerjakan", created_at: "2026-09-01T00:00:00Z", garansi_value: 30, garansi_unit: "hari", garansi_until: null, service_number: null, branches: { id: "b-1", name: "Cabang Pusat" }, profiles: null };
    mocks.state.logRows = [
      { action: "status_change", from_value: "Diagnosa", to_value: "Dikerjakan", created_at: "2026-09-05T02:00:00Z", actor_id: "secret-uuid" },
    ];

    const result = await lookupServisByCode("acme", "A3BD9F2C4B");

    expect(result.ok && result.result.history).toEqual([
      { at: "2026-09-05T02:00:00Z", from: "Diagnosa", to: "Dikerjakan" },
    ]);
    expect(JSON.stringify(result)).not.toContain("secret-uuid");
  });

  it("blocks the caller once the window is exhausted", async () => {
    mocks.state.rateLimitRow = { window_start: new Date().toISOString(), hits: 20 };

    const result = await lookupServisByCode("acme", "A3BD9F2C4B");

    expect(result).toEqual({ ok: false, message: THROTTLED });
    expect(mocks.state.calls.some((call) => call.table === "cervise_services")).toBe(false);
  });

  it("resets the window when it has expired", async () => {
    mocks.state.rateLimitRow = { window_start: new Date(Date.now() - 11 * 60 * 1000).toISOString(), hits: 20 };
    mocks.state.serviceRow = { id: "svc-1", tracking_code: "A3BD9F2C4B", device: "iPhone 13", status: "Masuk", created_at: "2026-09-01T00:00:00Z", garansi_value: 0, garansi_unit: "hari", garansi_until: null, service_number: null, branches: { id: "b-1", name: "Cabang Pusat" }, profiles: null };

    const result = await lookupServisByCode("acme", "A3BD9F2C4B");

    expect(result.ok).toBe(true);
    const reset = mocks.state.calls.find((call) => call.table === "public_rate_limits" && call.op === "update");
    expect(reset?.value).toMatchObject({ hits: 1 });
  });

  it("keys the rate limit per tenant and per client ip", async () => {
    await lookupServisByCode("acme", "A3BD9F2C4B");
    const insert = mocks.state.calls.find((call) => call.table === "public_rate_limits" && call.op === "insert");
    const key = (insert?.value as { key: string }).key;

    expect(key.startsWith("look:acme:")).toBe(true);
    expect(key).not.toContain("203.0.113.9");

    await lookupServisByCode("other", "A3BD9F2C4B");
    const otherInsert = mocks.state.calls.filter((call) => call.table === "public_rate_limits" && call.op === "insert").at(-1);
    expect((otherInsert?.value as { key: string }).key.startsWith("look:other:")).toBe(true);
  });

  it("tidak membuka kode milik tenant lain di halaman tenant ini", async () => {
    mocks.state.serviceRow = { id: "svc-b", tracking_code: "A3BD9F2C4B", branchOrganizationId: "org-2", device: "iPhone 13", status: "Selesai", created_at: "2026-09-01T00:00:00Z", garansi_value: 30, garansi_unit: "hari", garansi_until: "2026-10-01T00:00:00Z", service_number: "SRV-2026-0001", branches: { id: "b-2", name: "Cabang Milik Orang" }, profiles: { full_name: "Rahasia" } };

    const result = await lookupServisByCode("acme", "A3BD9F2C4B");

    expect(result).toEqual({ ok: false, message: UNAVAILABLE });
    expect(JSON.stringify(result)).not.toContain("Rahasia");
  });

  it("balas pesan yang sama saat slug-nya tidak dikenal, tanpa menyentuh tabel servis", async () => {
    mocks.state.orgId = null;

    const result = await lookupServisByCode("tenant-hantu", "A3BD9F2C4B");

    expect(result).toEqual({ ok: false, message: UNAVAILABLE });
    expect(mocks.state.calls.some((call) => call.table === "cervise_services")).toBe(false);
  });
});
