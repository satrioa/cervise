function isMasterAdmin(role: string) {
  return role.trim().toUpperCase() === "MASTER_ADMIN";
}

export function canSwitchTenant(role: string) {
  return isMasterAdmin(role);
}

export function canSwitchBranch(role: string) {
  return isMasterAdmin(role);
}
