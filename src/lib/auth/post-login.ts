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

  // PENGECILAN: ini adalah heuristic routing, BUKAN pemeriksaan ownership.
  //
  // Namanya dulu `hasOwnerMembership` dan itu salah baca: role MASTER_ADMIN
  // berarti mengelola operasional tenant, bukan memiliki atau membayar
  // paketnya. Sekarang kepemilikan dicatat terpisah di
  // organizations.owner_profile_id (lihat Actor.isOwner).
  //
  // Yang dicek di sini sebenarnya "apakah dia punya peran pengelola di salah
  // satu tenant-nya", supaya user dengan beberapa assignment dan tanpa peran
  // pengelola diarahkan ke /account/assignment-required, bukan langsung diberi
  // akses bebas ke semua tenant-nya.
  //
  // Sengaja TIDAK diganti ke owner_profile_id: seorang staf yang bekerja di dua
  // toko bukan pemilik keduanya, dan menjadikannya syarat akan menahan orang
  // yang sah dari tenant yang memang boleh dia akses. Cek ini hanya menentukan
  // ke mana user dikirim setelah login - otorisasi sebenarnya tetap di RLS dan
  // di getActiveTenant.
  const hasManagerMembership = input.memberships.some(
    (membership) => membership.role.toUpperCase() === "MASTER_ADMIN",
  );
  if (!hasManagerMembership) return "/account/assignment-required";

  const savedOrganizationIsValid = input.memberships.some(
    (membership) => membership.organizationId === input.savedOrganizationId,
  );
  return savedOrganizationIsValid ? "/app" : "/dashboard/tenant";
}
