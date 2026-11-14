import { describe, expect, it } from "vitest";
import { resolvePostLoginDestination } from "./post-login";

describe("resolvePostLoginDestination", () => {
  it("prioritizes an active platform admin over tenant memberships", () => {
    expect(resolvePostLoginDestination({
      isPlatformAdmin: true,
      savedOrganizationId: "org-1",
      memberships: [{ organizationId: "org-1", role: "MASTER_ADMIN" }],
    })).toBe("/owner");
  });

  it("routes a single-tenant owner directly to the app", () => {
    expect(resolvePostLoginDestination({
      isPlatformAdmin: false,
      savedOrganizationId: null,
      memberships: [{ organizationId: "org-1", role: "MASTER_ADMIN" }],
    })).toBe("/app");
  });

  it("routes a multi-tenant owner to first-login selection without a saved tenant", () => {
    expect(resolvePostLoginDestination({
      isPlatformAdmin: false,
      savedOrganizationId: null,
      memberships: [
        { organizationId: "org-1", role: "MASTER_ADMIN" },
        { organizationId: "org-2", role: "MASTER_ADMIN" },
      ],
    })).toBe("/dashboard/tenant");
  });

  it("menampilkan pemilih tenant untuk master admin multi-tenant meski ada tenant tersimpan", () => {
    // Steam-style: akun multi-tenant selalu lewat pemilih tenant setelah
    // login, walau ada tenant aktif yang tersimpan. Picker menyusun ulang
    // urutan dan menyorot tenant tersimpan lewat badge.
    expect(resolvePostLoginDestination({
      isPlatformAdmin: false,
      savedOrganizationId: "org-2",
      memberships: [
        { organizationId: "org-1", role: "MASTER_ADMIN" },
        { organizationId: "org-2", role: "MASTER_ADMIN" },
      ],
    })).toBe("/dashboard/tenant");
  });

  it("does not allow a saved tenant outside current memberships", () => {
    expect(resolvePostLoginDestination({
      isPlatformAdmin: false,
      savedOrganizationId: "stale-org",
      memberships: [
        { organizationId: "org-1", role: "MASTER_ADMIN" },
        { organizationId: "org-2", role: "MASTER_ADMIN" },
      ],
    })).toBe("/dashboard/tenant");
  });

  it("fails closed when a non-owner employee has multiple assignments", () => {
    expect(resolvePostLoginDestination({
      isPlatformAdmin: false,
      savedOrganizationId: "org-1",
      memberships: [
        { organizationId: "org-1", role: "ADMIN" },
        { organizationId: "org-2", role: "FRONTLINER" },
      ],
    })).toBe("/account/assignment-required");
  });

  it("routes an authenticated user without an active employee membership to onboarding", () => {
    expect(resolvePostLoginDestination({
      isPlatformAdmin: false,
      savedOrganizationId: null,
      memberships: [],
    })).toBe("/onboarding");
  });
});
