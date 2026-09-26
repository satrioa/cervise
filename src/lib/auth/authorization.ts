export type ProtectedPathKind = "app" | "tenant";
export type TenantAccessErrorCode =
  | "unauthenticated"
  | "tenant_not_found"
  | "assignment_required"
  | "branch_invalid"
  | "profile_inactive"
  | "subscription_blocked"
  | "lookup_failed";

export function getTenantAccessRedirect(code: TenantAccessErrorCode) {
  switch (code) {
    case "unauthenticated":
      return "/login?next=/app";
    case "tenant_not_found":
      return "/onboarding";
    case "assignment_required":
      return "/account/assignment-required";
    case "branch_invalid":
    case "profile_inactive":
    case "subscription_blocked":
      return "/login?error=tenant-access-denied";
    case "lookup_failed":
      return "/login?error=tenant-access-check-failed";
  }
}

export type EmployeeTarget = {
  organization_id: string;
  branch_id: string | null;
  profile_id: string;
};

export function isEmployeeTargetInOrganization(
  target: EmployeeTarget,
  organizationId: string,
  branchId?: string | null,
) {
  if (!target.profile_id || target.organization_id !== organizationId) {
    return false;
  }
  return branchId === undefined || target.branch_id === branchId;
}

export function normalizeRole(role: string | null | undefined) {
  const normalized = role?.trim().toUpperCase();
  return normalized ? normalized : null;
}

export function isManagerRole(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  return normalized === "MASTER_ADMIN" || normalized === "ADMIN";
}

export function isSalesRole(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  return normalized === "MASTER_ADMIN" || normalized === "ADMIN" || normalized === "FRONTLINER";
}

export function getProtectedPathKind(pathname: string): ProtectedPathKind | null {
  const withoutLocale = pathname.replace(/^\/(?:id|en)(?=\/|$)/i, "");
  if (withoutLocale === "/app" || withoutLocale.startsWith("/app/")) {
    return "app";
  }
  if (
    withoutLocale === "/dashboard/tenant" ||
    withoutLocale.startsWith("/dashboard/tenant/")
  ) {
    return "tenant";
  }
  return null;
}
