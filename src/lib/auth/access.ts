import { isMasterAdminRole } from "@/lib/auth/authorization";

/**
 * Pindah tenant/cabang hanya untuk MASTER_ADMIN. ADMIN sengaja tidak ikut:
 * dia boleh mengelola operasional cabangnya sendiri, bukan memilih tenant lain.
 */
export function canSwitchTenant(role: string) {
  return isMasterAdminRole(role);
}

export function canSwitchBranch(role: string) {
  return isMasterAdminRole(role);
}