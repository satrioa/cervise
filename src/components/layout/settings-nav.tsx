"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavGroup } from "@/lib/nav/manifest";

export type SettingsNavItem = { href: string; label: string };

/**
 * Bentuk datar, BUKAN `NavEntry[]`.
 *
 * Layout pengaturan adalah Server Component (butuh `getActiveTenant()` yang
 * memakai `cookies()`), sementara komponen ini Client Component. `NavEntry`
 * membawa `icon`, yaitu komponen React — sebuah fungsi — dan React melarang
 * apa pun yang bukan plain object melewati batas itu.
 */
export type SettingsNavGroup = {
  group: NavGroup;
  label?: string;
  entries: SettingsNavItem[];
};

function isEntryActive(pathname: string, href: string) {
  // `/app/pengaturan` adalah root tenant; cocok persis agar tidak
  // mengaktifkan semua sub-halaman tenant.
  return href === "/app/pengaturan"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

/** Pilih satu grup nav sesuai halaman aktif: akun dan sistem tidak digabung. */
function activeGroup(groups: SettingsNavGroup[], pathname: string): SettingsNavGroup | null {
  if (groups.length === 0) return null;
  for (const block of groups) {
    if (block.entries.some((entry) => isEntryActive(pathname, entry.href))) return block;
  }
  // Fallback: cocokkan awalan path (mis. halaman turunan).
  for (const block of groups) {
    if (block.entries.some((entry) => pathname.startsWith(entry.href))) return block;
  }
  return groups[0];
}

export function SettingsNav({ groups }: { groups: SettingsNavGroup[] }) {
  const pathname = usePathname();
  const block = activeGroup(groups, pathname);
  if (!block) return null;
  return (
    <nav className="flex-1 overflow-y-auto scrollbar-none px-3 py-3 space-y-5">
      <div key={block.group}>
        <div className="mb-1.5 px-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
          {block.label ?? block.group}
        </div>
        <ul className="flex flex-col gap-0.5">
          {block.entries.map((entry) => {
            const isActive = isEntryActive(pathname, entry.href);
            return (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center rounded-lg px-2.5 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-foreground/[0.07] font-medium text-foreground shadow-[inset_2px_0_0_0_hsl(var(--foreground)/0.35)]"
                      : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                  )}
                >
                  {entry.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

/** Nav horizontal mobile: hanya menu grup aktif (akun / pengaturan) agar tidak tercampur. */
export function SettingsMobileNav({ groups }: { groups: SettingsNavGroup[] }) {
  const pathname = usePathname();
  const block = activeGroup(groups, pathname);
  if (!block) return null;
  return (
    <div className="flex gap-1.5 min-w-max">
      {block.entries.map((entry) => {
        const isActive = isEntryActive(pathname, entry.href);
        return (
          <Link
            key={entry.href}
            href={entry.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors",
              isActive
                ? "border-foreground/20 bg-foreground/[0.07] text-foreground"
                : "border-border/60 bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {entry.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Label & deskripsi header sidebar mengikuti grup aktif. */
export function SettingsSectionHeader({ groups }: { groups: SettingsNavGroup[] }) {
  const pathname = usePathname();
  const block = activeGroup(groups, pathname);
  const label = block?.label ?? "Pengaturan";
  const isAccount = block?.group === "akun";
  return (
    <>
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
        {label}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {isAccount ? "Pengaturan akun pribadi" : "Konfigurasi tenant & sistem"}
      </p>
    </>
  );
}
