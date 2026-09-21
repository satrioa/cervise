"use client";

import {
  BarChart3,
  ChevronDown,
  LayoutDashboard,
  Search,
  Settings,
  Users,
  UserCog,
  Wallet,
  Wrench,
  LogOut,
  Store,
  Package,
  Building2,
  Receipt,
  ArrowLeftRight,
  FileText,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CerviseCommandPalette } from "@/components/layout/command-palette";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  { items: [{ label: "Dashboard", href: "/app", icon: LayoutDashboard }] },
  {
    label: "Operasional",
    items: [
      { label: "Servis", href: "/app/servis", icon: Wrench, badge: 12 },
      { label: "Inventory", href: "/app/inventory", icon: Package },
    ],
  },
  {
    label: "Manajemen",
    items: [
      { label: "Customer", href: "/app/customer", icon: Users },
      { label: "Karyawan", href: "/app/karyawan", icon: UserCog },
      { label: "Cabang", href: "/app/cabang", icon: Building2 },
    ],
  },
  {
    label: "Keuangan",
    items: [
      { label: "Transaksi", href: "/app/keuangan/transaksi", icon: Receipt },
      { label: "Arus Kas", href: "/app/keuangan/arus-kas", icon: ArrowLeftRight },
      { label: "Invoice", href: "/app/keuangan/invoice", icon: FileText },
    ],
  },
  {
    label: "Laporan",
    items: [
      { label: "Servis", href: "/app/laporan/servis", icon: Wrench },
      { label: "Keuangan", href: "/app/laporan/keuangan", icon: Wallet },
      { label: "Performa Karyawan", href: "/app/laporan/performa", icon: UserCheck },
    ],
  },
];

// flat for mobile bottom nav
export const FLAT_NAV = NAV_GROUPS.flatMap((g) => g.items);

function SidebarContent({ onNavigate, onSearchClick }: { onNavigate?: () => void; onSearchClick?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {/* Branch Switcher */}
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 border-b border-border/60 px-3.5 py-3 text-left transition-colors hover:bg-foreground/[0.03]"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-sm">Cervise Pusat</div>
            <div className="truncate font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Pro · 3 cabang</div>
          </div>
        </div>
        <ChevronDown className="size-3.5 opacity-60" />
      </button>

      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={onSearchClick}
          className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5 text-left transition-colors hover:bg-foreground/[0.04]"
        >
          <Search className="size-3.5 opacity-50" />
          <span className="flex-1 truncate text-muted-foreground text-xs">Cari servis, customer...</span>
          <kbd className="rounded border border-border/60 bg-background/80 px-1 font-mono text-[9px] text-muted-foreground">⌘K</kbd>
        </button>
      </div>

      <nav className="mt-3 flex-1 overflow-y-auto px-2 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label ?? "dashboard"} className="mt-3 first:mt-1">
            {group.label && <SectionLabel>{group.label}</SectionLabel>}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
                // highlight group parent for keuangan/laporan subpaths via startsWith works
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                        active ? "bg-foreground/[0.06] font-medium text-foreground" : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <item.icon className="size-4 opacity-70" />
                        {item.label}
                      </span>
                      {item.badge ? (
                        <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px]">
                          {item.badge}
                        </Badge>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="text-xs font-medium">Trial Pro 12 hari lagi</div>
          <p className="mt-1 text-xs text-muted-foreground">Upgrade untuk buka 3 cabang & 15 user.</p>
          <Button size="sm" className="mt-2 w-full h-7 text-xs">
            Lihat Paket
          </Button>
        </div>
      </nav>

      <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2.5">
        <div className="flex size-8 items-center justify-center rounded-full bg-foreground text-xs font-medium text-background">MA</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">Master Admin</div>
          <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Cervise Pusat
          </div>
        </div>
        <Link href="/login" className="rounded-md p-1.5 text-muted-foreground hover:bg-foreground/[0.04]">
          <LogOut className="size-4" />
        </Link>
        <button className="rounded-md p-1.5 text-muted-foreground hover:bg-foreground/[0.04]">
          <Settings className="size-4" />
        </button>
      </div>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 flex items-center justify-between px-2">
      <span className="font-mono text-[9px] text-muted-foreground/70 uppercase tracking-[0.25em]">{children}</span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="grid min-h-svh grid-cols-1 bg-background text-foreground lg:grid-cols-[260px_1fr]">
      <aside className="hidden h-svh flex-col border-r border-border/60 bg-foreground/[0.02] lg:flex sticky top-0">
        <SidebarContent onSearchClick={() => setCmdOpen(true)} />
      </aside>

      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-background px-3 py-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
            <LayoutDashboard className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu Cervise</SheetTitle>
            </SheetHeader>
            <SidebarContent
              onNavigate={() => setOpen(false)}
              onSearchClick={() => {
                setOpen(false);
                setTimeout(() => setCmdOpen(true), 200);
              }}
            />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2 font-semibold text-sm">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">C</span>
          Cervise
        </div>
        <div className="size-8" />
      </div>

      <CerviseCommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />

      <main className="flex min-h-0 flex-col">
        <div className="flex-1">{children}</div>

        <nav className="sticky bottom-0 z-30 flex items-center justify-around border-t border-border/60 bg-background px-1 py-1 lg:hidden safe-area-pb">
          {FLAT_NAV.slice(0, 4).map((item) => {
            const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 rounded-md px-3 py-1.5 text-[10px] ${active ? "text-foreground" : "text-muted-foreground"}`}
              >
                <item.icon className={`size-5 ${active ? "opacity-100" : "opacity-60"}`} />
                {item.label}
              </Link>
            );
          })}
          <Sheet>
            <SheetTrigger render={<button className="flex flex-col items-center gap-1 rounded-md px-3 py-1.5 text-[10px] text-muted-foreground" />}>
              <Settings className="size-5 opacity-60" />
              Lainnya
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto">
              <div className="grid grid-cols-3 gap-2 pt-2 pb-6">
                {FLAT_NAV.map((item) => (
                  <Link key={item.href} href={item.href} className="flex flex-col items-center gap-2 rounded-lg border p-3 text-xs">
                    <item.icon className="size-5" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </main>
    </div>
  );
}
