import { beforeEach, describe, expect, it, vi } from "vitest";

const { getActiveTenantMock, getActiveTenantForBillingMock, redirectMock } = vi.hoisted(() => ({
  getActiveTenantMock: vi.fn(),
  getActiveTenantForBillingMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/actor", () => ({
  getActiveTenant: getActiveTenantMock,
  getActiveTenantForBilling: getActiveTenantForBillingMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { assertCanRead, assertCanWrite, requireMenu, requireMenuForBilling } from "./require-menu";
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
    getActiveTenantForBillingMock.mockReset();
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

describe("requireMenuForBilling", () => {
  beforeEach(() => {
    getActiveTenantMock.mockReset();
    getActiveTenantForBillingMock.mockReset();
    redirectMock.mockReset();
  });

  it("memakai actor penagihan, bukan actor biasa", async () => {
    // Guard ini ada karena halaman tagihan harus tetap terbuka untuk tenant
    // yang langganannya habis. Kalau tanpa sengaja memakai `requireMenu`,
    // halaman itu ikut terkunci dan perbaikannya jadi tidak berarti.
    getActiveTenantForBillingMock.mockResolvedValue(actorWithRole("MASTER_ADMIN"));
    await requireMenuForBilling("pengaturan_subscription");
    expect(getActiveTenantForBillingMock).toHaveBeenCalledTimes(1);
    expect(getActiveTenantMock).not.toHaveBeenCalled();
  });

  it("tetap memeriksa role seperti guard biasa", async () => {
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("tenant terkunci tetap boleh membuka halaman paket dari role mana pun", async () => {
    // Halaman tagihan adalah jalur pemulihan. Kalau role biasa ikut
    // dialihkan ke `/app?error=forbidden`, layout akan melempar
    // `subscription_expired` lagi dan tenant berputar tanpa henti.
    for (const role of ["ADMIN", "FRONTLINER", "TECHNICIAN"]) {
      getActiveTenantForBillingMock.mockResolvedValue(actorWithRole(role));
      redirectMock.mockReset();
      const actor = await requireMenuForBilling("pengaturan_subscription");
      expect(actor.role).toBe(role);
      expect(redirectMock).not.toHaveBeenCalled();
    }
  });

  it("halaman selain tagihan tetap menolak role tanpa hak", async () => {
    // Pengecualian hanya untuk halaman tagihan, bukan pembuka semua halaman.
    for (const role of ["ADMIN", "FRONTLINER", "TECHNICIAN"]) {
      getActiveTenantForBillingMock.mockResolvedValue(actorWithRole(role));
      redirectMock.mockReset();
      await requireMenuForBilling("pengaturan_usage");
      expect(redirectMock).toHaveBeenCalledWith("/app?error=forbidden");
    }
  });

  it("MASTER_ADMIN boleh membuka halaman paket", async () => {
    getActiveTenantForBillingMock.mockResolvedValue(actorWithRole("MASTER_ADMIN"));
    const actor = await requireMenuForBilling("pengaturan_subscription");
    expect(actor.role).toBe("MASTER_ADMIN");
    expect(redirectMock).not.toHaveBeenCalled();
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
