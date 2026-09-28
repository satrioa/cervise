export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 63);
}

/**
 * Apakah user ini pemilik tenant yang tercatat.
 *
 * Sumber kebenarannya organizations.owner_profile_id, yang diisi saat tenant
 * dibuat mengikuti created_by. Sengaja TIDAK memakai employees.role:
 * MASTER_ADMIN berarti mengelola operasional, yang berbeda darizia
 * membayar paketnya.
 *
 * Null owner_profile_id berarti tenant yang belum punya pemilik tercatat, dan
 * itu dianggap bukan pemilik - lebih baik menolak daripada menebak.
 */
export function isTenantOwner(
  ownerProfileId: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!ownerProfileId || !userId) return false;
  return ownerProfileId === userId;
}
