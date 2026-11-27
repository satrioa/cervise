"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { House, LayoutGrid, Package, ShoppingCart, Wrench, type LucideIcon } from "lucide-react";
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
export function CompactDockNav({
  role,
  hidden = false,
  onOpenMenu,
}: {
  role: string;
  hidden?: boolean;
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
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-30 transition-[transform,opacity] duration-200 lg:hidden group-has-[[data-hide-dock]]/shell:hidden",
        hidden ? "translate-y-full opacity-0" : "translate-y-0 opacity-100",
      )}
      data-compact-dock=""
    >
      <div className="pointer-events-auto relative flex items-center gap-2 px-4 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {/* Fade hitam di belakang tombol; wrap dock sendiri tetap transparan. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-black/40 via-black/20 to-transparent"
        />
        <nav
          aria-label="Navigasi utama"
          className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-muted/80 p-1.5 ring-1 ring-border/60 backdrop-blur"
        >
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Button
                key={item.href}
                variant="ghost"
                size="icon-lg"
                aria-label={item.label}
                className={cn(
                  active
                    ? "justify-start gap-2 rounded-full bg-card px-4 text-foreground shadow-sm dark:bg-neutral-800"
                    : "size-11 shrink-0 rounded-full text-muted-foreground",
                )}
                render={
                  <MainNavLink href={item.href} aria-current={active ? "page" : undefined}>
                    {null}
                  </MainNavLink>
                }
              >
                <Icon className="size-[18px] shrink-0" fill={active ? "currentColor" : "none"} />
                {active ? <span className="truncate text-sm font-medium">{item.label}</span> : null}
              </Button>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Buka menu"
          className="pointer-events-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-lg"
        >
          <LayoutGrid className="size-5" />
        </button>
      </div>
    </div>
  );
}

type NavItem = { href: string; label: string; icon: LucideIcon };

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}
