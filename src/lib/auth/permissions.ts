/**
 * Katalog izin yang bisa diberikan ke role buatan sendiri.
 *
 * Satu sumber untuk UI role, pemeriksaan di server, dan validasi sebelum
 * disimpan. Kunci mengikuti OPERASI, bukan menu: satu halaman bisa butuh
 * `services.read` untuk dibuka dan `services.update` untuk menyimpan.
 *
 * Izin role bawaan TIDAK ditulis di sini. Itu diturunkan dari manifest
 * (`permissionsForSystemRole`) supaya menu dan izin tidak pernah berbeda
 * pendapat. File ini sengaja tidak mengimpor manifest agar tidak melingkar.
 */

export const PERMISSION_CATALOG = [
  {
    group: "servis",
    label: "Servis",
    permissions: [
      { key: "services.read", label: "Lihat servis" },
      { key: "services.create", label: "Buat servis" },
      { key: "services.update", label: "Ubah servis" },
      { key: "services.delete", label: "Hapus servis" },
      { key: "services.payment", label: "Terima pembayaran servis" },
      { key: "services.sparepart", label: "Kelola sparepart servis" },
    ],
  },
  {
    group: "customer",
    label: "Customer",
    permissions: [
      { key: "customers.read", label: "Lihat customer" },
      { key: "customers.write", label: "Tambah/ubah customer" },
      { key: "customers.delete", label: "Hapus customer" },
    ],
  },
  {
    group: "penjualan",
    label: "Penjualan",
    permissions: [
      { key: "sales.read", label: "Lihat penjualan" },
      { key: "sales.create", label: "Buat penjualan" },
      { key: "sales.update", label: "Ubah penjualan" },
      { key: "sales.delete", label: "Hapus penjualan" },
      { key: "sales.price_override", label: "Ubah harga jual" },
    ],
  },
  {
    group: "inventori",
    label: "Inventori",
    permissions: [
      { key: "products.read", label: "Lihat produk" },
      { key: "products.write", label: "Tambah/ubah produk" },
      { key: "inventory.adjust", label: "Sesuaikan stok" },
    ],
  },
  {
    group: "keuangan",
    label: "Keuangan",
    permissions: [
      { key: "finance.read", label: "Lihat transaksi & arus kas" },
      { key: "finance.write", label: "Catat transaksi keuangan" },
    ],
  },
  {
    group: "laporan",
    label: "Laporan",
    permissions: [
      { key: "reports.service", label: "Laporan servis" },
      { key: "reports.finance", label: "Laporan keuangan" },
      { key: "reports.sales", label: "Laporan penjualan" },
      { key: "reports.performance", label: "Performa teknisi" },
      { key: "reports.shift", label: "Laporan shift" },
    ],
  },
  {
    group: "karyawan",
    label: "Karyawan",
    permissions: [
      { key: "employees.read", label: "Lihat karyawan" },
      { key: "employees.write", label: "Kelola karyawan" },
    ],
  },
  {
    group: "cabang",
    label: "Cabang",
    permissions: [
      { key: "branches.read", label: "Lihat cabang" },
      { key: "branches.write", label: "Kelola cabang" },
    ],
  },
  {
    group: "layanan",
    label: "Layanan",
    permissions: [
      { key: "warranty.read", label: "Lihat garansi" },
      { key: "audit.read", label: "Lihat audit log" },
    ],
  },
  {
    group: "pengaturan",
    label: "Pengaturan",
    permissions: [
      { key: "settings.read", label: "Lihat pengaturan" },
      { key: "settings.write", label: "Ubah pengaturan sistem" },
      { key: "subscription.read", label: "Lihat subscription" },
      { key: "usage.read", label: "Lihat usage" },
      { key: "roles.read", label: "Lihat role & izin" },
      { key: "roles.write", label: "Kelola role & izin" },
    ],
  },
] as const;

export type PermissionKey =
  (typeof PERMISSION_CATALOG)[number]["permissions"][number]["key"];

export const PERMISSION_KEYS: PermissionKey[] = PERMISSION_CATALOG.flatMap(
  (group) => group.permissions.map((permission) => permission.key),
);

const PERMISSION_KEY_SET = new Set<string>(PERMISSION_KEYS);

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEY_SET.has(value);
}

/**
 * Role bawaan yang boleh menjadi dasar role buatan sendiri.
 *
 * MASTER_ADMIN tidak termasuk: itu plafon sistem (pemilik tenant, tagihan,
 * dan pengelolaan karyawan). Kalau boleh dipakai sebagai dasar, pemilik toko
 * bisa membuat "admin kedua" yang tidak bisa ia cabut sendiri.
 */
export const CUSTOM_BASE_ROLES = ["ADMIN", "FRONTLINER", "TECHNICIAN"] as const;

export type CustomBaseRole = (typeof CUSTOM_BASE_ROLES)[number];

export function isCustomBaseRole(value: string | null | undefined): value is CustomBaseRole {
  return typeof value === "string" && (CUSTOM_BASE_ROLES as readonly string[]).includes(value.trim().toUpperCase());
}

/** Label tampilan untuk role dasar. */
export const BASE_ROLE_LABEL: Record<CustomBaseRole, string> = {
  ADMIN: "Admin",
  FRONTLINER: "Frontliner",
  TECHNICIAN: "Teknisi",
};

export function permissionLabel(key: string): string {
  for (const group of PERMISSION_CATALOG) {
    const found = group.permissions.find((permission) => permission.key === key);
    if (found) return found.label;
  }
  return key;
}
