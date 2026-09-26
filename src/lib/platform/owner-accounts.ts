export type AccountState = "active" | "inactive" | "unassigned";

export type AuthAccountInput = {
  id: string;
  email: string | null;
  phone: string | null;
  metadataName: string | null;
  confirmed: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

export type ProfileAccountInput = {
  id: string;
  fullName: string | null;
  phone: string | null;
  active: boolean;
};

export type EmployeeAccountInput = {
  id: string;
  profileId: string;
  organizationId: string;
  branchId: string;
  role: string;
  active: boolean;
};

export type OrganizationAccountInput = { id: string; name: string };
export type BranchAccountInput = { id: string; name: string };

export type SubscriptionAccountInput = {
  organizationId: string;
  status: string;
  packageName: string | null;
};

export type PlatformAdminInput = { profileId: string; active: boolean };

export type OwnerAccountRow = {
  id: string;
  employeeId: string | null;
  email: string | null;
  phone: string | null;
  fullName: string;
  tenantName: string | null;
  branchName: string | null;
  role: string;
  state: AccountState;
  isActive: boolean;
  isAssigned: boolean;
  isUnassigned: boolean;
  isPlatformAdmin: boolean;
  subscriptionStatus: string | null;
  packageName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
};

export function buildOwnerAccountRows(input: {
  users: AuthAccountInput[];
  profiles: ProfileAccountInput[];
  employees: EmployeeAccountInput[];
  organizations: OrganizationAccountInput[];
  branches: BranchAccountInput[];
  subscriptions: SubscriptionAccountInput[];
  platformAdmins: PlatformAdminInput[];
}): OwnerAccountRow[] {
  const profiles = new Map(input.profiles.map((profile) => [profile.id, profile]));
  const employees = new Map(input.employees.map((employee) => [employee.profileId, employee]));
  const organizations = new Map(input.organizations.map((organization) => [organization.id, organization.name]));
  const branches = new Map(input.branches.map((branch) => [branch.id, branch.name]));
  const subscriptions = new Map(input.subscriptions.map((subscription) => [subscription.organizationId, subscription]));
  const platformAdmins = new Map(input.platformAdmins.map((admin) => [admin.profileId, admin]));

  return input.users
    .map((user) => {
      const profile = profiles.get(user.id);
      const employee = employees.get(user.id);
      const platformAdmin = platformAdmins.get(user.id);
      const subscription = employee ? subscriptions.get(employee.organizationId) : undefined;
      const isPlatformAdmin = Boolean(platformAdmin);
      const isActive = user.confirmed && (platformAdmin?.active ?? true) && (profile?.active ?? true) && (employee?.active ?? true);
      const isAssigned = Boolean(employee);
      const state: AccountState = !isActive ? "inactive" : isAssigned || isPlatformAdmin ? "active" : "unassigned";

      return {
        id: user.id,
        employeeId: employee?.id ?? null,
        email: user.email ?? null,
        phone: user.phone ?? profile?.phone ?? null,
        fullName: profile?.fullName ?? user.metadataName ?? user.email ?? "Tanpa nama",
        tenantName: employee ? organizations.get(employee.organizationId) ?? null : null,
        branchName: employee ? branches.get(employee.branchId) ?? null : null,
        role: isPlatformAdmin ? "PLATFORM_ADMIN" : employee?.role ?? "UNASSIGNED",
        state,
        isActive,
        isAssigned,
        isUnassigned: !isAssigned && !isPlatformAdmin,
        isPlatformAdmin,
        subscriptionStatus: subscription?.status ?? null,
        packageName: subscription?.packageName ?? null,
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
      } satisfies OwnerAccountRow;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
