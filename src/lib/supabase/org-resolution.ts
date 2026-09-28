/**
 * Menentukan tenant aktif dari pilihan user dan daftar assignment yang benar.
 *
 * Fungsi murni supaya aturan ini bisa diuji tanpa database. Aturannya sengaja
 * eksplisit karena versi sebelumnya sangat membingungkan:
 * bila cookie menunjuk tenant yang tidak punya assignment untuk user ini, org
 * diganti ke assignment pertama TANPA memberitahu siapa pun. Efeknya di UI:
 * switcher menampilkan "JCellular" sementara seluruh data yang dimuat tetap
 * milik "Servisin" - terlihat seperti data bocor antar tenant, padahal
 * sebenarnya tenant yang diminta memang tidak bisa diakses.
 */

export type OrgAssignment = {
  organization_id: string;
};

export type OrgResolution = {
  organizationId: string;
  /**
   * true = pilihan user tidak bisa diakses, jadi assignment pertama yang
   * dipakai. Pemanggil boleh memakainya untuk logger atau pengumuman, tapi
   * tidak boleh berpura-pura bahwa pilihan user dipakai.
   */
  usedFallback: boolean;
  requestedOrgId: string | null;
};

export function resolveTargetOrganization(
  requestedOrgId: string | null | undefined,
  assignments: OrgAssignment[],
): OrgResolution | null {
  // Tidak ada assignment sama sekali - pemanggil yang melempar error,
  // karena pesannya bergantung pada konteks (mis. "belum punya tenant").
  if (assignments.length === 0) return null;

  const requested = requestedOrgId?.trim() ? requestedOrgId.trim() : null;
  if (!requested) {
    return { organizationId: assignments[0].organization_id, usedFallback: true, requestedOrgId: null };
  }

  const match = assignments.find((assignment) => assignment.organization_id === requested);
  if (match) {
    return { organizationId: match.organization_id, usedFallback: false, requestedOrgId: requested };
  }

  // Diminta tenant yang tidak ada di daftar assignment user ini.
  return { organizationId: assignments[0].organization_id, usedFallback: true, requestedOrgId: requested };
}
