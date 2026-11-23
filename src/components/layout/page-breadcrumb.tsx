"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { NAV_ENTRIES, type NavEntry, type NavGroup } from "@/lib/nav/manifest";
import { useShellChrome } from "./shell-chrome";

/** Grup sidebar yang tampil sebagai crumb. Grup tanpa label dilewati. */
const GROUP_LABEL: Partial<Record<NavGroup, string>> = {
  operasional: "Operasional",
  manajemen: "Manajemen",
  keuangan: "Keuangan",
  laporan: "Laporan",
  layanan: "Layanan",
};

/** Label untuk segmen path yang dikenal. Sisanya dibuat dari slug-nya. */
const SEGMENT_LABEL: Record<string, string> = {
  servis: "Servis",
  baru: "Baru",
  inventori: "Inventori",
  opname: "Stock Opname",
  sparepart: "Sparepart",
  "kategori-sparepart": "Kategori Sparepart",
  penjualan: "Penjualan",
  customer: "Customer",
  karyawan: "Data Karyawan",
  cabang: "Cabang",
  garansi: "Garansi",
  "analitik-servis": "Analitik Servis",
  "audit-log": "Audit Log",
  keuangan: "Keuangan",
  transaksi: "Transaksi",
  "arus-kas": "Arus Kas",
  laporan: "Laporan",
  shift: "Shift",
  performa: "Performa",
  pengaturan: "Pengaturan",
  profil: "Profil",
  role: "Role",
  tampilan: "Tampilan",
  nota: "Nota",
  lokalisasi: "Lokalisasi",
  subscription: "Subscription",
  usage: "Usage",
};

export function labelFor(segment: string): string {
  return (
    SEGMENT_LABEL[segment] ??
    segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

/** Entri menu untuk path ini, atau induk terdekatnya untuk rute detail. */
export function matchEntry(pathname: string): NavEntry | undefined {
  const exact = NAV_ENTRIES.find((entry) => entry.href === pathname);
  if (exact) return exact;
  return NAV_ENTRIES.filter((entry) => pathname.startsWith(`${entry.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}

/**
 * Breadcrumb halaman master admin, dibangun dari URL.
 *
 * `PageHeader` tetap server component, jadi pembacaan `usePathname` dipindah ke
 * sini. Di shell compact (teknisi/frontliner) judul lama dipertahankan supaya
 * perubahan breadcrumb benar-benar hanya untuk master admin.
 */
export function PageBreadcrumb({
  title,
  titleClassName,
}: {
  title: ReactNode;
  titleClassName?: string;
}) {
  const pathname = usePathname();
  const shellHasChrome = useShellChrome();

  if (shellHasChrome) {
    return <h1 className={cn("truncate font-heading text-xl", titleClassName)}>{title}</h1>;
  }

  const parts = pathname.split("/").filter(Boolean);
  const rest = parts[0] === "app" ? parts.slice(1) : parts;
  const links: { label: string; href: string; hideOnMobile?: boolean }[] = [
    { label: "Dashboard", href: "/app" },
  ];
  const entry = matchEntry(pathname);
  const groupLabel = entry ? GROUP_LABEL[entry.group] : undefined;

  if (entry && groupLabel) {
    const groupHref = NAV_ENTRIES.find((item) => item.group === entry.group)?.href ?? "/app";
    links.push({ label: groupLabel, href: groupHref, hideOnMobile: true });
  }

  // Segmen setelah entri menu induk (mis. /app/servis/baru). Grup yang sudah
  // jadi crumb tidak diulang lagi sebagai segmen.
  const parent =
    entry && pathname.startsWith(`${entry.href}/`) ? entry.href : null;
  const tailBase = parent ?? "/app";
  const tail = parent
    ? pathname.slice(parent.length).split("/").filter(Boolean)
    : entry
      ? []
      : rest.length > 1
        ? rest.slice(0, -1)
        : [];
  // Rute bertingkat di bawah entri menu (mis. /app/inventori/opname):
  // entri induknya ikut jadi crumb sebelum segmen turunannya.
  if (parent && entry && tail.length > 0) {
    links.push({ label: entry.label, href: entry.href, hideOnMobile: true });
  }
  for (let index = 0; index < tail.length - 1; index += 1) {
    links.push({
      label: labelFor(tail[index]),
      href: `${tailBase}/${tail.slice(0, index + 1).join("/")}`,
    });
  }

  const current =
    typeof title === "string"
      ? title
      : tail.length > 0
        ? labelFor(tail[tail.length - 1])
        : rest.length > 0
          ? labelFor(rest[rest.length - 1])
          : "Halaman";

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="min-w-0 flex-nowrap overflow-hidden">
        {links.map((crumb) => (
          <Fragment key={crumb.href}>
            {/* Mobile hanya menampilkan nama halaman saat ini; semua tautan
                dan pemisahnya baru tampil mulai breakpoint sm. */}
            <BreadcrumbItem className="hidden sm:inline-flex">
              <BreadcrumbLink render={<Link href={crumb.href} />}>
                {crumb.label}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:block" />
          </Fragment>
        ))}
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate">{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
