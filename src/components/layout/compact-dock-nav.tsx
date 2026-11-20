"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { House, Package, ShoppingCart, Wrench, type LucideIcon } from "lucide-react";
import { MainNavLink } from "@/components/layout/main-nav-transition";
import { normalizeAppRole } from "@/lib/nav/manifest";
import { cn } from "@/lib/utils";

/**
 * Navigasi bawah shell compact (mobile).
 *
 * Hanya tujuan halaman, bukan seluruh menu: pengaturan, analitik, dan printer
 * tetap di `CompactMenuSheet` supaya form-nya tidak dipaksa masuk ke tab kecil.
 * Item ketiga mengikuti role, sama seperti tab header di `CompactShell`.
 */
export function CompactDockNav({ role, collapsed = false }: { role: string; collapsed?: boolean }) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const third: NavItem =
    normalizeAppRole(role) === "TECHNICIAN"
      ? { href: "/app/sparepart", label: t("items.sparepart"), icon: Package }
      : { href: "/app/penjualan", label: t("items.sales"), icon: ShoppingCart };

  const items: NavItem[] = [
    { href: "/app", label: "Home", icon: House },
    { href: "/app/servis", label: t("items.service"), icon: Wrench },
    third,
  ];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 lg:hidden" data-compact-dock="">
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-1 bg-white/95 px-8 shadow-[0_-8px_24px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/5 backdrop-blur transition-[padding] duration-200 dark:bg-neutral-900/95 dark:ring-white/10",
          collapsed
            ? "pt-0.5 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
            : "pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]",
        )}
      >
        <nav
          aria-label="Navigasi utama"
          className="flex min-w-0 flex-1 items-center justify-around gap-0.5"
        >
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <MainNavLink
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 text-[10px] font-medium leading-none transition-colors",
                  collapsed ? "py-0.5" : "py-1.5",
                  active
                    ? "text-[#2563EB]"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
                )}
              >
                <Icon className="size-[18px]" fill="currentColor" />
                {collapsed ? null : (
                  <span className="max-w-full truncate">{item.label}</span>
                )}
              </MainNavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

type NavItem = { href: string; label: string; icon: LucideIcon };

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}
