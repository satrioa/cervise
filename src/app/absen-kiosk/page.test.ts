import { beforeEach, describe, expect, it, vi } from "vitest";
import { wibDate } from "@/lib/attendance/status";

const { fromMock, eqCalls, readSessionMock } = vi.hoisted(() => {
  const eqCalls: Array<[string, unknown]> = [];
  const fromMock = vi.fn((table: string) => ({
    select: () => ({
      eq: (col: string, value: unknown) => {
        eqCalls.push([col, value]);
        if (table === "employees") {
          return { maybeSingle: async () => ({ data: { profile_id: "profile-1" }, error: null }) };
        }
        return {
          gte: (col: string, value: unknown) => {
            eqCalls.push([col, value]);
            return { order: () => ({ limit: async () => ({ data: [], error: null }) }) };
          },
        };
      },
    }),
  }));
  return { fromMock, eqCalls, readSessionMock: vi.fn() };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: fromMock }) }));
vi.mock("./actions", () => ({ readSession: readSessionMock }));

import AbsenKioskPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  eqCalls.length = 0;
  readSessionMock.mockResolvedValue({
    employeeId: "emp-row-1",
    organizationId: "org-1",
    branchId: "b-1",
    name: "Budi",
    exp: Date.now() + 60_000,
  });
});

describe("AbsenKioskPage", () => {
  it("memfilter log dengan profile_id, bukan employee row id", async () => {
    await AbsenKioskPage();
    expect(eqCalls).toContainEqual(["id", "emp-row-1"]);
    expect(eqCalls).toContainEqual(["employee_id", "profile-1"]);
  });

  it("membatasi riwayat 30 hari terakhir", async () => {
    await AbsenKioskPage();
    const expected = wibDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
    expect(eqCalls).toContainEqual(["attendance_date", expected]);
  });
});
