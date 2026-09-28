import {
  LayoutDashboard,
  Wrench,
  ShoppingCart,
  Package,
  Users,
  UserCog,
  Building2,
  Receipt,
  ArrowLeftRight,
  Wallet,
  UserCheck,
  ScrollText,
  ShieldIcon,
  Settings,
  BarChart3,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

/**
 * Sumber kebenaran tunggal untuk navigasi dan hak akses.
 *
 * Sebelumnya hak akses tersebar di tiga tempat yang tidak saling sinkron:
 * `MENU_ACCESS` (src/lib/rbac.ts), `NAV_GROUPS` + `navItemKey()`
 * (src/components/layout/app-shell.tsx), dan `GROUPS`
 * (src/app/app/pengaturan/layout.tsx). Ketiganya sekarang membaca daftar ini.
 *
 * Konvensi role: HURUF BESAR, mengikuti nilai `employees.role` di database.
 * Bentuk lowercase ("teknisi") tidak pernah dipakai di sini.
 */

export const APP_ROLE = [
  "MASTER_ADMIN",
  "ADMIN",
  "FRONTLINER",
  "TECHNICIAN",
] as const;

export type AppRole = (typeof APP_ROLE)[number];

/** Shell mana yang menampilkan entri. Satu halaman bisa tampil di keduanya. */
export type Surface = "legacy" | "compact";

export type NavGroup =
  | "dashboard"
  | "operasional"
  | "manajemen"
  | "keuangan"
  | "laporan"
  | "layanan"
  | "akun"
  | "pengaturan";

export type NavEntry = {
  href: string;
  /** Kunci label di `messages/<locale>.json` pada `nav.items`. */
  key: string;
  /** Fallback kalau kunci i18n belum ada. */
  label: string;
  icon: LucideIcon;
  group: NavGroup;
  /** Role yang boleh membuka halaman. */
  roles: AppRole[];
  surface: Surface[];
  /** Role yang boleh membuka tapi tidak boleh menulis. */
  readOnly?: AppRole[];
  /** Kunci kapabilitas tanpa rute, mis. `inventory` untuk `/app/inventori`. */
  menuKeys?: string[];
};

const ALL: AppRole[] = ["MASTER_ADMIN", "ADMIN", "FRONTLINER", "TECHNICIAN"];
const MANAGERS: AppRole[] = ["MASTER_ADMIN", "ADMIN"];
const CASHIERS: AppRole[] = ["MASTER_ADMIN", "ADMIN", "FRONTLINER"];

export const NAV_ENTRIES: NavEntry[] = [
  {
    href: "/app",
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    group: "dashboard",
    roles: ALL,
    surface: ["legacy"],
    menuKeys: ["dashboard"],
  },
  {
    href: "/app/servis",
    key: "service",
    label: "Servis",
    icon: Wrench,
    group: "operasional",
    roles: ALL,
    surface: ["legacy", "compact"],
    menuKeys: ["servis"],
  },
  {
    href: "/app/customer",
    key: "customer",
    label: "Customer",
    icon: Users,
    group: "operasional",
    roles: CASHIERS,
    surface: ["legacy", "compact"],
    menuKeys: ["customer"],
  },
  {
    href: "/app/penjualan",
    key: "sales",
    label: "Penjualan",
    icon: ShoppingCart,
    group: "keuangan",
    roles: CASHIERS,
    surface: ["legacy", "compact"],
    menuKeys: ["penjualan"],
  },
  {
    href: "/app/inventori",
    key: "inventory",
    label: "Inventori",
    icon: Package,
    group: "operasional",
    roles: ALL,
    surface: ["legacy", "compact"],
    menuKeys: ["inventory"],
  },
  {
    href: "/app/kategori-sparepart",
    key: "sparepart",
    label: "Sparepart",
    icon: Package,
    group: "operasional",
    roles: ["MASTER_ADMIN", "ADMIN", "TECHNICIAN"],
    surface: ["legacy", "compact"],
    menuKeys: ["kategori_sparepart"],
  },
  {
    href: "/app/karyawan",
    key: "employee",
    label: "Karyawan",
    icon: UserCog,
    group: "manajemen",
    roles: MANAGERS,
    surface: ["legacy"],
    menuKeys: ["karyawan"],
  },
  {
    href: "/app/cabang",
    key: "branch",
    label: "Cabang",
    icon: Building2,
    group: "manajemen",
    roles: MANAGERS,
    readOnly: ["ADMIN"],
    surface: ["legacy"],
    menuKeys: ["cabang"],
  },
  {
    href: "/app/keuangan/transaksi",
    key: "transaction",
    label: "Transaksi",
    icon: Receipt,
    group: "keuangan",
    roles: CASHIERS,
    surface: ["legacy", "compact"],
  },
  {
    href: "/app/keuangan/arus-kas",
    key: "cashflow",
    label: "Arus Kas",
    icon: ArrowLeftRight,
    group: "keuangan",
    roles: CASHIERS,
    surface: ["legacy", "compact"],
  },
  {
    href: "/app/analitik-servis",
    key: "analyticsService",
    label: "Analitik Servis",
    icon: BarChart3,
    group: "laporan",
    roles: ["FRONTLINER", "TECHNICIAN"],
    surface: ["compact"],
  },
  {
    href: "/app/laporan/servis",
    key: "reportService",
    label: "Servis",
    icon: Wrench,
    group: "laporan",
    roles: ALL,
    surface: ["legacy", "compact"],
  },
  {
    href: "/app/laporan/keuangan",
    key: "reportFinance",
    label: "Keuangan",
    icon: Wallet,
    group: "laporan",
    roles: CASHIERS,
    surface: ["legacy", "compact"],
  },
  {
    href: "/app/laporan/penjualan",
    key: "reportSales",
    label: "Penjualan",
    icon: ShoppingCart,
    group: "laporan",
    roles: CASHIERS,
    surface: ["legacy", "compact"],
  },
  {
    href: "/app/laporan/performa",
    key: "reportPerformance",
    label: "Performa Teknisi",
    icon: UserCheck,
    group: "laporan",
    roles: CASHIERS,
    surface: ["legacy"],
  },
  {
    href: "/app/laporan/shift",
    key: "reportShift",
    label: "Laporan Shift",
    icon: ClipboardList,
    group: "laporan",
    roles: MANAGERS,
    surface: ["legacy"],
  },
  {
    href: "/app/garansi",
    key: "warranty",
    label: "Garansi",
    icon: ScrollText,
    group: "layanan",
    roles: ALL,
    surface: ["legacy", "compact"],
    menuKeys: ["garansi"],
  },
  {
    href: "/app/audit-log",
    key: "auditLog",
    label: "Audit Log",
    icon: ShieldIcon,
    group: "layanan",
    roles: MANAGERS,
    surface: ["legacy"],
    menuKeys: ["audit_log"],
  },
  {
    href: "/app/pengaturan/profil",
    key: "profile",
    label: "Profil",
    icon: Settings,
    group: "akun",
    roles: ALL,
    surface: ["legacy", "compact"],
  },
  {
    href: "/app/pengaturan/lokalisasi",
    key: "localization",
    label: "Lokalisasi",
    icon: Settings,
    group: "akun",
    roles: ALL,
    surface: ["legacy", "compact"],
    menuKeys: ["pengaturan_lokalisasi"],
  },
  {
    href: "/app/pengaturan",
    key: "settings",
    label: "Pengaturan Sistem",
    icon: Settings,
    group: "pengaturan",
    roles: ["MASTER_ADMIN"],
    surface: ["legacy"],
    menuKeys: ["pengaturan_general"],
  },
  {
    href: "/app/pengaturan/tampilan",
    key: "appearance",
    label: "Tampilan",
    icon: Settings,
    group: "pengaturan",
    roles: ["MASTER_ADMIN"],
    surface: ["legacy"],
    menuKeys: ["pengaturan_tampilan"],
  },
  {
    href: "/app/pengaturan/subscription",
    key: "subscription",
    label: "Subscription",
    icon: Settings,
    group: "pengaturan",
    roles: ["MASTER_ADMIN"],
    surface: ["legacy"],
    menuKeys: ["pengaturan_subscription"],
  },
  {
    href: "/app/pengaturan/usage",
    key: "usage",
    label: "Usage",
    icon: Settings,
    group: "pengaturan",
    roles: ["MASTER_ADMIN"],
    surface: ["legacy"],
    menuKeys: ["pengaturan_usage"],
  },
];

/**
 * Kapabilitas yang tidak punya rute sendiri. Dipanggil dari server action
 * melalui `canAccess()`, bukan dari sidebar.
 */
const CAPABILITY_ACCESS: Record<string, AppRole[]> = {
  // `servis/actions.ts` memakai ini untuk mencatat pembayaran servis.
  // FRONTLINER sengaja TIDAK termasuk: dia memakai dialog pembayaran sendiri.
  keuangan_transaksi: ["MASTER_ADMIN", "ADMIN"],
  // `penjualan/actions.ts` memakai ini untuk overriding harga jual.
  harga_jual: ["MASTER_ADMIN", "ADMIN"],
};

export const CAPABILITY_KEYS = Object.keys(CAPABILITY_ACCESS);

export const GROUP_LABEL_KEY: Record<NavGroup, string | null> = {
  dashboard: null,
  operasional: "groups.operational",
  manajemen: "groups.management",
  keuangan: "groups.finance",
  laporan: "groups.reports",
  layanan: "groups.services",
  akun: null,
  pengaturan: null,
};

export function isAppRole(value: string | null | undefined): value is AppRole {
  return typeof value === "string" && (APP_ROLE as readonly string[]).includes(value.trim().toUpperCase());
}

export function normalizeAppRole(role: string | null | undefined): AppRole | null {
  if (!role) return null;
  const upper = role.trim().toUpperCase();
  return isAppRole(upper) ? upper : null;
}

export function entryForHref(href: string): NavEntry | undefined {
  return NAV_ENTRIES.find((entry) => entry.href === href);
}

export function entryForMenuKey(key: string): NavEntry | undefined {
  return NAV_ENTRIES.find((entry) => entry.menuKeys?.includes(key));
}

/**
 * Satu-satunya jalan untuk menjawab "apakah role ini boleh?".
 * Menerima `href` penuh atau `menuKeys`.
 */
export function canAccess(role: string | null | undefined, key: string): boolean {
  const normalized = normalizeAppRole(role);
  if (!normalized) return false;
  if (key in CAPABILITY_ACCESS) return CAPABILITY_ACCESS[key].includes(normalized);
  const entry = NAV_ENTRIES.find((item) => item.href === key || item.menuKeys?.includes(key));
  return entry ? entry.roles.includes(normalized) : false;
}

export function canWrite(role: string | null | undefined, key: string): boolean {
  const normalized = normalizeAppRole(role);
  if (!normalized) return false;
  const entry = NAV_ENTRIES.find((item) => item.href === key || item.menuKeys?.includes(key));
  if (!entry) return false;
  if (entry.readOnly?.includes(normalized)) return false;
  return entry.roles.includes(normalized);
}

/** Shell yang dipakai role ini, ditentukan oleh entri `/app`. */
export function surfaceFor(role: string | null | undefined): Surface {
  const normalized = normalizeAppRole(role);
  const dashboard = entryForHref("/app");
  if (!normalized || !dashboard) return "legacy";
  if (!dashboard.roles.includes(normalized)) return "legacy";
  return dashboard.surface.includes("compact") ? "compact" : "legacy";
}

export type NavGroupBlock = { group: NavGroup; entries: NavEntry[] };

const GROUP_ORDER: NavGroup[] = [
  "dashboard",
  "operasional",
  "manajemen",
  "keuangan",
  "laporan",
  "layanan",
  "akun",
  "pengaturan",
];

/**
 * Group yang tidak dirender sebagai item sidebar pada shell tertentu.
 * Di shell compact, profil dan lokalisasi diakses lewat ikon pengaturan di
 * footer — bukan lewat daftar menu — supaya sidebar tetap ringkas.
 */
const HIDDEN_GROUPS: Record<Surface, NavGroup[]> = {
  legacy: [],
  compact: ["akun"],
};

export function navFor(role: string | null | undefined, surface: Surface): NavGroupBlock[] {
  const normalized = normalizeAppRole(role);
  if (!normalized) return [];

  const hidden = HIDDEN_GROUPS[surface];
  const visible = NAV_ENTRIES.filter(
    (entry) =>
      entry.surface.includes(surface) &&
      entry.roles.includes(normalized) &&
      !hidden.includes(entry.group),
  );

  const blocks: NavGroupBlock[] = [];
  for (const group of GROUP_ORDER) {
    const entries = visible.filter((entry) => entry.group === group);
    if (entries.length > 0) blocks.push({ group, entries });
  }
  return blocks;
}

/** Semua entri yang boleh dibuka role ini pada shell tersebut, termasuk group tersembunyi. */
export function entriesFor(
  role: string | null | undefined,
  surface: Surface,
): NavEntry[] {
  const normalized = normalizeAppRole(role);
  if (!normalized) return [];
  return NAV_ENTRIES.filter(
    (entry) => entry.surface.includes(surface) && entry.roles.includes(normalized),
  );
}
