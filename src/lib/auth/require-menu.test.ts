import { beforeEach, describe, expect, it, vi } from "vitest";

const { getActiveTenantMock, redirectMock } = vi.hoisted(() => ({
  getActiveTenantMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/actor", () => ({
  getActiveTenant: getActiveTenantMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { assertCanRead, assertCanWrite, requireMenu } from "./require-menu";
import type { Actor } from "@/lib/supabase/actor";

function actorWithRole(role: string): Actor {
  return {
    userId: "u1",
    orgId: "o1",
    branchId: "b1",
    employeeId: "e1",
    role,
    fullName: "Tester",
    avatarUrl: null,
    subscription: null,
  } as unknown as Actor;
}

describe("requireMenu", () => {
  beforeEach(() => {
    getActiveTenantMock.mockReset();
    redirectMock.mockReset();
  });

  it("mengembalikan actor dan tidak redirect bila role berhak", async () => {
    getActiveTenantMock.mockResolvedValue(actorWithRole("ADMIN"));
    const actor = await requireMenu("/app/karyawan");
    expect(actor.role).toBe("ADMIN");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("melempar redirect bila role tidak berhak", async () => {
    getActiveTenantMock.mockResolvedValue(actorWithRole("FRONTLINER"));
    await requireMenu("/app/karyawan");
    expect(redirectMock).toHaveBeenCalledWith("/app?error=forbidden");
  });

  it("menerima menuKeys selain href", async () => {
    getActiveTenantMock.mockResolvedValue(actorWithRole("ADMIN"));
    await requireMenu("karyawan");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("FRONTLINER boleh halaman penjualan", async () => {
    getActiveTenantMock.mockResolvedValue(actorWithRole("FRONTLINER"));
    await requireMenu("/app/penjualan");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("FRONTLINER tidak boleh keuangan_transaksi", async () => {
    getActiveTenantMock.mockResolvedValue(actorWithRole("FRONTLINER"));
    await requireMenu("keuangan_transaksi");
    expect(redirectMock).toHaveBeenCalledWith("/app?error=forbidden");
  });

  it("TECHNICIAN boleh servis", async () => {
    getActiveTenantMock.mockResolvedValue(actorWithRole("TECHNICIAN"));
    await requireMenu("/app/servis");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("TECHNICIAN tidak boleh pengaturan", async () => {
    getActiveTenantMock.mockResolvedValue(actorWithRole("TECHNICIAN"));
    await requireMenu("/app/pengaturan");
    expect(redirectMock).toHaveBeenCalledWith("/app?error=forbidden");
  });

  it("hanya MASTER_ADMIN boleh halaman pengaturan", async () => {
    for (const role of ["ADMIN", "FRONTLINER", "TECHNICIAN"]) {
      getActiveTenantMock.mockResolvedValue(actorWithRole(role));
      await requireMenu("/app/pengaturan/subscription");
      expect(redirectMock).toHaveBeenCalledWith("/app?error=forbidden");
    }
    getActiveTenantMock.mockResolvedValue(actorWithRole("MASTER_ADMIN"));
    await requireMenu("/app/pengaturan/subscription");
    expect(redirectMock).toHaveBeenCalledTimes(3);
  });
});

describe("assertCanRead", () => {
  it("meloloskan role yang berhak", () => {
    expect(() => assertCanRead(actorWithRole("MASTER_ADMIN"), "karyawan")).not.toThrow();
  });

  it("melempar error deskriptif bila tidak berhak", () => {
    expect(() => assertCanRead(actorWithRole("TECHNICIAN"), "karyawan")).toThrow(
      /tidak diizinkan mengakses/,
    );
  });
});

describe("assertCanWrite", () => {
  it("ADMIN read-only di cabang tidak boleh menulis", () => {
    expect(() => assertCanWrite(actorWithRole("ADMIN"), "/app/cabang")).toThrow(
      /tidak diizinkan mengubah/,
    );
  });

  it("MASTER_ADMIN boleh menulis cabang", () => {
    expect(() => assertCanWrite(actorWithRole("MASTER_ADMIN"), "/app/cabang")).not.toThrow();
  });

  it("ADMIN boleh menulis karyawan", () => {
    expect(() => assertCanWrite(actorWithRole("ADMIN"), "karyawan")).not.toThrow();
  });

  it("FRONTLINER tidak boleh menulis karyawan meski tidak bisa membacanya", () => {
    expect(() => assertCanWrite(actorWithRole("FRONTLINER"), "karyawan")).toThrow();
  });
});
