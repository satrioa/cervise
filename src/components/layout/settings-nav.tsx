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
 * apa pun yang bukan plain object melewati batas itu. Mengirim `NavEntry`
 * langsung menghasilkan:
 *
 *   Only plain objects can be passed to Client Components from Server
 *   Components.
 *
 * Ikon memang tidak pernah dipakai di sini, jadi bentuk datarnya bukan
 * sekadar pemangkasan.
 */
export type SettingsNavGroup = {
  group: NavGroup;
  label?: string;
  entries: SettingsNavItem[];
};

export function SettingsNav({ groups }: { groups: SettingsNavGroup[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto px-2 pb-4">
      {groups.map((block) => (
        <div key={block.group} className="mt-4 first:mt-2">
          <div className="px-2 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
            {block.label ?? block.group}
          </div>
          <ul className="mt-1 flex flex-col gap-0.5">
            {block.entries.map((entry) => {
              // `/app/pengaturan` adalah root yang persis; yang lain cocok dengan prefix.
              const isActive =
                entry.href === "/app/pengaturan"
                  ? pathname === entry.href
                  : pathname.startsWith(entry.href);
              return (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    className={cn(
                      "flex w-full rounded-md px-2 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-foreground/[0.06] font-medium text-foreground"
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
      ))}
    </nav>
  );
}
