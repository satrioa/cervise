import { describe, expect, it } from "vitest";
import { fetchLoginAccess, resolveLoginAccess, type LoginAccess } from "./login-access";

function access(overrides: Partial<LoginAccess> = {}): LoginAccess {
  return {
    isPlatformAdmin: false,
    profileActive: true,
    activeMemberships: [],
    hasMembershipRecord: false,
    hasInactiveOwnership: false,
    ...overrides,
  };
}

describe("resolveLoginAccess", () => {
  it("mengirim platform admin ke /owner", () => {
    expect(
      resolveLoginAccess({
        access: access({ isPlatformAdmin: true, hasMembershipRecord: true }),
        savedOrganizationId: null,
      }),
    ).toEqual({ kind: "redirect", destination: "/owner" });
  });

  it("mengirim user tanpa tenant sama sekali ke onboarding", () => {
    expect(
      resolveLoginAccess({ access: access(), savedOrganizationId: null }),
    ).toEqual({ kind: "redirect", destination: "/onboarding" });
  });

  it("menolak member tenant yang tidak aktif, bukan mengirim ke onboarding", () => {
    // Ini bug utama: baris employees tidak terlihat oleh RLS saat langganan
    // berakhir, dan dulu hasil kosong itu dibaca sebagai "belum punya tenant".
    expect(
      resolveLoginAccess({
        access: access({ hasMembershipRecord: true }),
        savedOrganizationId: null,
      }),
    ).toEqual({ kind: "denied", reason: "tenant-inactive" });
  });

  it("memakai pesan khusus owner saat tenant pemilik tidak aktif", () => {
    expect(
      resolveLoginAccess({
        access: access({ hasMembershipRecord: true, hasInactiveOwnership: true }),
        savedOrganizationId: null,
      }),
    ).toEqual({ kind: "denied", reason: "tenant-owner-inactive" });
  });

  it("menolak profil yang dinonaktifkan", () => {
    expect(
      resolveLoginAccess({
        access: access({ profileActive: false }),
        savedOrganizationId: null,
      }),
    ).toEqual({ kind: "denied", reason: "account-inactive" });
  });

  it("tetap mengizinkan user yang punya satu tenant aktif", () => {
    expect(
      resolveLoginAccess({
        access: access({
          activeMemberships: [{ organizationId: "org-1", role: "MASTER_ADMIN" }],
          hasMembershipRecord: true,
        }),
        savedOrganizationId: null,
      }),
    ).toEqual({ kind: "redirect", destination: "/app" });
  });

  it("tetap mengizinkan user multi-tenant selama ada satu tenant aktif", () => {
    expect(
      resolveLoginAccess({
        access: access({
          activeMemberships: [{ organizationId: "org-1", role: "MASTER_ADMIN" }],
          hasMembershipRecord: true,
          hasInactiveOwnership: true,
        }),
        savedOrganizationId: "org-expired",
      }),
    ).toEqual({ kind: "redirect", destination: "/app" });
  });

  it("memilih tenant aktif yang disimpan, bukan tenant expired", () => {
    expect(
      resolveLoginAccess({
        access: access({
          activeMemberships: [
            { organizationId: "org-1", role: "MASTER_ADMIN" },
            { organizationId: "org-2", role: "MASTER_ADMIN" },
          ],
        }),
        savedOrganizationId: "org-2",
      }),
    ).toEqual({ kind: "redirect", destination: "/app" });
  });
});

function rpcClient(result: { data?: unknown; error?: { message: string } | null }) {
  return { rpc: async () => result } as unknown as Parameters<typeof fetchLoginAccess>[0];
}

describe("fetchLoginAccess", () => {
  it("memetakan respons RPC ke bentuk yang dipakai resolver", async () => {
    await expect(
      fetchLoginAccess(
        rpcClient({
          data: {
            is_platform_admin: false,
            profile_active: true,
            active_memberships: [{ organization_id: "org-1", role: "MASTER_ADMIN" }],
            has_membership_record: true,
            has_inactive_ownership: false,
          },
          error: null,
        }),
      ),
    ).resolves.toEqual({
      isPlatformAdmin: false,
      profileActive: true,
      activeMemberships: [{ organizationId: "org-1", role: "MASTER_ADMIN" }],
      hasMembershipRecord: true,
      hasInactiveOwnership: false,
    });
  });

  it("menolak respons tidak lengkap, bukan menganggapnya belum punya tenant", async () => {
    // Kalau parser default ke false, user tenant expired bisa terlempar ke
    // onboarding. Fail closed: error lebih baik daripada data tenant bocor.
    await expect(
      fetchLoginAccess(rpcClient({ data: { profile_active: true }, error: null })),
    ).rejects.toThrow(/tidak valid/i);
  });

  it("menolak anggota dengan bentuk yang tidak dikenal", async () => {
    await expect(
      fetchLoginAccess(
        rpcClient({
          data: {
            is_platform_admin: false,
            profile_active: true,
            active_memberships: [{ organization_id: "org-1" }],
            has_membership_record: true,
            has_inactive_ownership: false,
          },
          error: null,
        }),
      ),
    ).rejects.toThrow(/tidak valid/i);
  });

  it("melempar saat RPC gagal", async () => {
    await expect(
      fetchLoginAccess(rpcClient({ data: null, error: { message: "network" } })),
    ).rejects.toThrow(/Gagal memeriksa/);
  });
});
