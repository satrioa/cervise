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
  ShieldIcon,
  ScrollTextIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CerviseCommandPalette } from "@/components/layout/command-palette";
import { BranchProvider, useBranch, BRANCHES } from "@/lib/branch-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

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
  {
    label: "Layanan",
    items: [{ label: "Audit Log", href: "/app/audit-log", icon: ShieldIcon }],
  },
];

// flat for mobile bottom nav
export const FLAT_NAV = NAV_GROUPS.flatMap((g) => g.items);

function BranchSwitcher() {
  const { branch, setBranch, branches } = useBranch();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 border-b border-border/60 px-3.5 py-3 text-left transition-colors hover:bg-foreground/[0.03]"
          />
        }
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
            <Store className="size-4" />
          </div>
          <div className="min-w-0 text-left">
            <div className="truncate font-semibold text-sm">{branch.label}</div>
            <div className="truncate font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{branch.meta}</div>
          </div>
        </div>
        <ChevronDown className="size-3.5 opacity-60 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-[248px] p-1">
        <div className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Pilih cabang</div>
        {branches.map((b) => {
          const active = branch.id === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setBranch(b);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                active ? "bg-foreground/[0.06] text-foreground" : "hover:bg-foreground/[0.04] text-muted-foreground hover:text-foreground"
              )}
            >
              <Store className="size-4 opacity-70 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{b.label}</div>
                <div className="truncate text-[11px] text-muted-foreground">{b.meta}</div>
              </div>
              {active && <CheckIcon className="size-4 text-primary shrink-0" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function SidebarContent({ onNavigate, onSearchClick }: { onNavigate?: () => void; onSearchClick?: () => void }) {
  const pathname = usePathname();
  const { branch } = useBranch();
  return (
    <>
      <BranchSwitcher />

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

      <nav className="mt-3 flex-1 overflow-y-auto scrollbar-none px-2 pb-4">
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
            <span className="truncate">{branch.label}</span>
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

function AppShellInner({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const canScroll = scrollHeight > clientHeight + 4;
    setShowTopFade(canScroll && scrollTop > 6);
    setShowBottomFade(canScroll && scrollTop + clientHeight < scrollHeight - 6);
  }, []);

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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateFade();
    const ro = new ResizeObserver(updateFade);
    ro.observe(el);
    const content = el.querySelector("[data-main-content]") as Element | null;
    if (content) ro.observe(content);
    // MutationObserver fallback for content that changes without resize event
    const mo = new MutationObserver(updateFade);
    mo.observe(el, { childList: true, subtree: true });
    window.addEventListener("resize", updateFade);
    const id = requestAnimationFrame(updateFade);
    const tid = setTimeout(updateFade, 150);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", updateFade);
      cancelAnimationFrame(id);
      clearTimeout(tid);
    };
  }, [updateFade, pathname]);

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background text-foreground lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden h-svh shrink-0 flex-col border-r border-border/60 bg-foreground/[0.02] lg:flex sticky top-0 overflow-hidden">
        <SidebarContent onSearchClick={() => setCmdOpen(true)} />
      </aside>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:col-start-2">
        <div className="lg:hidden sticky top-0 z-40 flex shrink-0 items-center justify-between border-b border-border/60 bg-background px-3 py-2">
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

        <div
          ref={scrollRef}
          onScroll={updateFade}
          className="relative flex-1 overflow-y-auto overflow-x-hidden scrollbar-none scroll-smooth"
        >
          {/* progressive blur — top */}
          <div
            aria-hidden
            className="pointer-events-none sticky top-0 z-10 -mb-8 h-8 bg-gradient-to-b from-background via-background/60 to-transparent backdrop-blur-[6px] [mask-image:linear-gradient(to_bottom,black_0%,black_35%,transparent_100%)] transition-opacity duration-300"
            style={{ opacity: showTopFade ? 1 : 0 }}
          />
          <div data-main-content className="min-h-full">
            {children}
          </div>
          {/* progressive blur — bottom */}
          <div
            aria-hidden
            className="pointer-events-none sticky bottom-0 z-10 -mt-8 h-8 bg-gradient-to-t from-background via-background/60 to-transparent backdrop-blur-[6px] [mask-image:linear-gradient(to_top,black_0%,black_35%,transparent_100%)] transition-opacity duration-300"
            style={{ opacity: showBottomFade ? 1 : 0 }}
          />
        </div>

        <nav className="shrink-0 sticky bottom-0 z-30 flex items-center justify-around border-t border-border/60 bg-background px-1 py-1 lg:hidden safe-area-pb">
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
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <BranchProvider>
      <AppShellInner>{children}</AppShellInner>
    </BranchProvider>
  );
}
