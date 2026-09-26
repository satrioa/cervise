import { describe, expect, it } from "vitest";
import { buildOwnerAccountRows } from "./owner-accounts";

describe("buildOwnerAccountRows", () => {
  it("includes registered accounts that are not assigned to a tenant", () => {
    const rows = buildOwnerAccountRows({
      users: [
        {
          id: "user-1",
          email: "new@example.com",
          phone: "628111",
          metadataName: "New User",
          confirmed: true,
          createdAt: "2026-09-25T00:00:00.000Z",
          lastSignInAt: null,
        },
      ],
      profiles: [],
      employees: [],
      organizations: [],
      branches: [],
      subscriptions: [],
      platformAdmins: [],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: "new@example.com",
      fullName: "New User",
      role: "UNASSIGNED",
      state: "unassigned",
      isAssigned: false,
      isUnassigned: true,
      isActive: true,
    });
  });

  it("marks platform admins separately from tenant staff", () => {
    const rows = buildOwnerAccountRows({
      users: [
        {
          id: "admin-1",
          email: "admin@example.com",
          phone: null,
          metadataName: "Platform Admin",
          confirmed: true,
          createdAt: "2026-09-25T00:00:00.000Z",
          lastSignInAt: "2026-09-25T01:00:00.000Z",
        },
      ],
      profiles: [{ id: "admin-1", fullName: "Admin", phone: null, active: true }],
      employees: [],
      organizations: [],
      branches: [],
      subscriptions: [],
      platformAdmins: [{ profileId: "admin-1", active: true }],
    });

    expect(rows[0]).toMatchObject({
      role: "PLATFORM_ADMIN",
      state: "active",
      isPlatformAdmin: true,
      isUnassigned: false,
    });
  });

  it("joins tenant, branch, and subscription data for staff", () => {
    const rows = buildOwnerAccountRows({
      users: [
        {
          id: "staff-1",
          email: "staff@example.com",
          phone: "628222",
          metadataName: null,
          confirmed: true,
          createdAt: "2026-09-25T00:00:00.000Z",
          lastSignInAt: null,
        },
      ],
      profiles: [{ id: "staff-1", fullName: "Staff Cervise", phone: null, active: true }],
      employees: [
        {
          id: "employee-1",
          profileId: "staff-1",
          organizationId: "org-1",
          branchId: "branch-1",
          role: "ADMIN",
          active: true,
        },
      ],
      organizations: [{ id: "org-1", name: "Cervise Retail" }],
      branches: [{ id: "branch-1", name: "Cabang Pusat" }],
      subscriptions: [
        {
          organizationId: "org-1",
          status: "active",
          packageName: "Pro",
        },
      ],
      platformAdmins: [],
    });

    expect(rows[0]).toMatchObject({
      fullName: "Staff Cervise",
      tenantName: "Cervise Retail",
      branchName: "Cabang Pusat",
      role: "ADMIN",
      packageName: "Pro",
      subscriptionStatus: "active",
      state: "active",
      isAssigned: true,
      isUnassigned: false,
    });
  });

  it("keeps an inactive platform admin distinct from an unassigned account", () => {
    const rows = buildOwnerAccountRows({
      users: [
        {
          id: "admin-2",
          email: "inactive-admin@example.com",
          phone: null,
          metadataName: null,
          confirmed: true,
          createdAt: "2026-09-25T00:00:00.000Z",
          lastSignInAt: null,
        },
      ],
      profiles: [],
      employees: [],
      organizations: [],
      branches: [],
      subscriptions: [],
      platformAdmins: [{ profileId: "admin-2", active: false }],
    });

    expect(rows[0]).toMatchObject({
      role: "PLATFORM_ADMIN",
      state: "inactive",
      isPlatformAdmin: true,
      isUnassigned: false,
      isActive: false,
    });
  });
});
