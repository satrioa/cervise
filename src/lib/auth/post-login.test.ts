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

  it("mengizinkan master admin multi-tenant masuk ke app jika tenant tersimpan valid", () => {
    expect(resolvePostLoginDestination({
      isPlatformAdmin: false,
      savedOrganizationId: "org-2",
      memberships: [
        { organizationId: "org-1", role: "MASTER_ADMIN" },
        { organizationId: "org-2", role: "MASTER_ADMIN" },
      ],
    })).toBe("/app");
  });

  it("mengirim master admin multi-tenant ke pemilih tenant jika tenant tersimpan tidak valid", () => {
    expect(resolvePostLoginDestination({
      isPlatformAdmin: false,
      savedOrganizationId: "org-missing",
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
