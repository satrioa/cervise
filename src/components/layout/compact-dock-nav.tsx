"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { House, Package, ShoppingCart, Wrench, type LucideIcon } from "lucide-react";
import { MainNavLink } from "@/components/layout/main-nav-transition";
import { Button } from "@/components/ui/button";
import { normalizeAppRole } from "@/lib/nav/manifest";
import { cn } from "@/lib/utils";

/**
 * Navigasi bawah shell compact (mobile).
 *
 * Hanya tujuan halaman, bukan seluruh menu: pengaturan, analitik, dan printer
 * tetap di `CompactMenuSheet` supaya form-nya tidak dipaksa masuk ke tab kecil.
 * Item ketiga mengikuti role, sama seperti tab header di `CompactShell`.
 */
export function CompactDockNav({ role, hidden = false }: { role: string; hidden?: boolean }) {
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
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-30 transition-[transform,opacity] duration-200 lg:hidden",
        hidden ? "translate-y-full opacity-0" : "translate-y-0 opacity-100",
      )}
      data-compact-dock=""
    >
      <div className="pointer-events-auto relative flex items-center gap-1 px-8 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {/* Fade hitam di belakang tombol; wrap dock sendiri tetap transparan. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/40 to-transparent"
        />
        <nav
          aria-label="Navigasi utama"
          className="flex min-w-0 flex-1 items-center justify-around gap-2"
        >
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Button
                key={item.href}
                variant="candy"
                shape="square"
                size="icon-lg"
                className={cn(
                  "size-14 flex-col gap-1 rounded-none text-[10px] leading-none",
                  "[--btn:#fff] [--btn-hover:#f3f4ff] [--btn-fg:var(--color-brand)]",
                  active ? "opacity-100" : "opacity-80",
                )}
                render={
                  <MainNavLink href={item.href} aria-current={active ? "page" : undefined}>
                    {null}
                  </MainNavLink>
                }
              >
                <Icon className="size-5" fill="currentColor" />
                <span className="max-w-full truncate">{item.label}</span>
              </Button>
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
