import { requireMenu } from "@/lib/auth/require-menu";
import { getRoles, getBaseRoleCatalog, getPermissionGroups } from "@/app/app/pengaturan/role/actions";
import { RoleManager } from "@/app/app/pengaturan/role/role-manager";

/**
 * Halaman manage role & izin. Hanya Master Admin yang boleh membuka.
 */
export default async function RolePage() {
  await requireMenu("pengaturan_role");
  const [roles, baseCatalog, permissionGroups] = await Promise.all([
    getRoles(),
    getBaseRoleCatalog(),
    getPermissionGroups(),
  ]);
  return <RoleManager roles={roles} baseCatalog={baseCatalog} permissionGroups={permissionGroups} />;
}