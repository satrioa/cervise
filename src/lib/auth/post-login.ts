export type PostLoginMembership = {
  organizationId: string;
  role: string;
};

export type PostLoginDestination =
  | "/owner"
  | "/app"
  | "/dashboard/tenant"
  | "/account/assignment-required"
  | "/onboarding";

export function resolvePostLoginDestination(input: {
  isPlatformAdmin: boolean;
  savedOrganizationId: string | null;
  memberships: PostLoginMembership[];
}): PostLoginDestination {
  if (input.isPlatformAdmin) return "/owner";
  if (input.memberships.length === 0) return "/onboarding";
  if (input.memberships.length === 1) return "/app";

  const hasOwnerMembership = input.memberships.some(
    (membership) => membership.role.toUpperCase() === "MASTER_ADMIN",
  );
  if (!hasOwnerMembership) return "/account/assignment-required";

  const savedOrganizationIsValid = input.memberships.some(
    (membership) => membership.organizationId === input.savedOrganizationId,
  );
  return savedOrganizationIsValid ? "/app" : "/dashboard/tenant";
}
