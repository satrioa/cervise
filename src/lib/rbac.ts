export type Role = "super_owner" | "master_admin" | "admin" | "frontliner" | "teknisi";

export const ROLE_LABEL: Record<Role, string> = {
  super_owner: "Super Owner",
  master_admin: "Master Admin",
  admin: "Admin",
  frontliner: "Frontliner",
  teknisi: "Teknisi",
};

export const MENU_ACCESS: Record<string, Role[]> = {
  dashboard: ["super_owner", "master_admin", "admin", "frontliner", "teknisi"],
  servis: ["super_owner", "master_admin", "admin", "frontliner", "teknisi"],
  sparepart: ["super_owner", "master_admin", "admin"], // Hanya Admin per request
  inventory: ["super_owner", "master_admin", "admin"], // alias lama — hapus setelah migrasi route selesai
  customer: ["super_owner", "master_admin", "admin", "frontliner"],
  karyawan: ["super_owner", "master_admin", "admin"],
  cabang: ["super_owner", "master_admin", "admin"],
  keuangan_transaksi: ["super_owner", "master_admin", "admin"],
  keuangan_arus_kas: ["super_owner", "master_admin", "admin"],
  laporan_servis: ["super_owner", "master_admin", "admin"],
  laporan_keuangan: ["super_owner", "master_admin", "admin"],
  laporan_performa: ["super_owner", "master_admin", "admin"],
  laporan_performa_teknisi: ["super_owner", "master_admin", "admin"],
};

export function canAccess(role: Role, menu: string) {
  return MENU_ACCESS[menu]?.includes(role) ?? false;
}
