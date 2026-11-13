"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  House,
  LayoutGrid,
  Package,
  ShoppingCart,
  Wrench,
  type LucideIcon,
} from "lucide-react";
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
export function CompactDockNav({
  role,
  menuOpen,
  onOpenMenu,
}: {
  role: string;
  menuOpen: boolean;
  onOpenMenu: () => void;
}) {
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:hidden" data-compact-dock="">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/95 p-1.5 shadow-[0_16px_38px_-24px_rgba(0,0,0,0.55)] ring-1 ring-black/5 backdrop-blur dark:bg-neutral-900/95 dark:ring-white/10">
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
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-medium leading-none transition-colors",
                  active
                    ? "bg-brand/[0.12] text-brand"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
                )}
              >
                <Icon className="size-[18px]" />
                <span className="max-w-full truncate">{item.label}</span>
              </MainNavLink>
            );
          })}

          <button
            type="button"
            onClick={onOpenMenu}
            aria-expanded={menuOpen}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-medium leading-none transition-colors",
              menuOpen
                ? "bg-brand/[0.12] text-brand"
                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
            )}
          >
            <LayoutGrid className="size-[18px]" />
            <span className="max-w-full truncate">{t("menu.title")}</span>
          </button>
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
