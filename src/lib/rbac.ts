/**
 * Shim kompatibilitas.
 *
 * Dulunya file ini adalah sumber hak akses ketiga (setelah `NAV_GROUPS` di
 * app-shell dan `GROUPS` di pengaturan/layout), dengan `MENU_ACCESS` berisi 24
 * kunci yang tidak pernah dipakai untuk memfilter sidebar. Masalah terbesarnya:
 * nilainya `"teknisi"` sementara kolom `employees.role` berisi `TECHNICIAN`,
 * sehingga `canAccess("TECHNICIAN", …)` mengembalikan `false` untuk setiap
 * kunci — termasuk `dashboard` dan `servis`.
 *
 * Sekarang semua aturan ada di `src/lib/nav/manifest.ts`. File ini hanya
 * meneruskan, supaya sepuluh server action yang mengimpor dari
 * `@/lib/rbac` tidak perlu diubah sekaligus.
 */
export {
  APP_ROLE,
  CAPABILITY_KEYS,
  NAV_ENTRIES,
  canAccess,
  canWrite,
  entriesFor,
  entryForHref,
  entryForMenuKey,
  isAppRole,
  navFor,
  normalizeAppRole,
  surfaceFor,
  type AppRole,
  type NavEntry,
  type NavGroup,
  type Surface,
} from "./nav/manifest";
