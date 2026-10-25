"use client";

import {
  ChevronsUpDown,
  Settings,
  Wrench,
  LogOut,
  PlusIcon,
  HomeIcon,
  Package,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { sfx } from "@/lib/sound";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommandPaletteProvider } from "@/components/layout/command-palette-provider";
import { BranchProvider, useBranch } from "@/lib/branch-context";
import { TenantProvider, useTenant } from "@/lib/tenant-context";
import { TrialCard } from "@/components/layout/trial-card";
import { SoundToggle } from "@/components/layout/sound-toggle";
import { GROUP_LABEL_KEY, canAccess, navFor } from "@/lib/nav/manifest";
import { LocaleProvider } from "@/lib/localization-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MultipleAccounts, type AccountOption } from "@/components/uitripled/multiple-accounts-shadcnui";
import { IdentityAvatar } from "@/components/identity-avatar";
import { TenantLogo } from "@/components/layout/tenant-logo";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { canSwitchBranch, canSwitchTenant } from "@/lib/auth/access";
import { isMasterAdminRole } from "@/lib/auth/authorization";
import type { BranchOption } from "@/lib/supabase/branch-scope";

export const ROLE_LABEL: Record<string, string> = {
  MASTER_ADMIN: "Master Admin",
  ADMIN: "Admin",
  FRONTLINER: "Frontliner",
  TECHNICIAN: "Technician",
};

function roleLabel(role: string) {
  return ROLE_LABEL[role.toUpperCase()] ?? role;
}

function TenantSwitcher({ canSwitchTenant: canSwitchTenantValue }: { canSwitchTenant: boolean }) {
  const router = useRouter();
  const { tenants, activeOrgId, setActiveOrg, loading, isPlatformAdmin } = useTenant();
  if (loading) {
    return (
      <div className="w-full px-3.5 py-3 text-xs text-muted-foreground">
        Memuat tenant...
      </div>
    );
  }
  if (!tenants.length) {
    return (
      <div className="w-full px-3.5 py-3">
        <div className="text-sm font-medium">Belum ada Tenant</div>
        {isPlatformAdmin ? (
          <div className="text-xs text-muted-foreground">Buat tenant di /owner</div>
        ) : null}
      </div>
    );
  }
  const activeTenant = tenants.find((tenant) => tenant.id === activeOrgId) ?? tenants[0];
  if (!canSwitchTenantValue) {
    return (
      <div className="flex w-full items-center gap-2.5 px-3.5 py-2">
        <TenantLogo
          logoUrl={activeTenant?.logoUrl}
          name={activeTenant?.name}
          title={`Tenant: ${activeTenant?.name ?? "Tenant"}`}
          className="size-8 text-xs"
        />
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Tenant assigned</div>
          <div className="mt-1 truncate font-semibold">{activeTenant?.name ?? "Tenant"}</div>
        </div>
      </div>
    );
  }
  const accounts: AccountOption[] = tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    description: `${tenant.paket ?? "tenant"} · Organization`,
    plan: tenant.paket ?? "trial",
    // Dipakai MultipleAccounts untuk merender AvatarImage. Sebelumnya field ini
    // ada di tipe tapi tidak pernah diisi, jadi Logo tenant tidak pernah tampil.
    avatarUrl: tenant.logoUrl ?? undefined,
  }));
  return (
    <MultipleAccounts
      accounts={accounts}
      value={activeOrgId}
      onValueChange={setActiveOrg}
      // Hanya staff platform yang boleh membuat tenant dari sini. Tombol ini
      // dulu selalu dirender, jadi MASTER_ADMIN biasa (pemilik tenant, bukan
      // staff Cervise) mengkliknya dan dihantarkan ke layar login - padahal
      // session-nya masih hidup. onManage opsional di MultipleAccounts, jadi
      // tidak meneruskannya sudah cukup untuk menyembunyikan tombol.
      {...(isPlatformAdmin
        ? { onManage: () => router.push("/owner/new"), manageLabel: "Buat Tenant Baru" }
        : {})}
      bare
    />
  );
}

function BranchSwitcher({ canSwitch }: { canSwitch: boolean }) {
  const { branch, setBranch, branches } = useBranch();
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  if (!canSwitch) {
    return (
      <div className="flex h-12 w-full items-center rounded-xl border border-border/60 bg-white px-2.5 dark:bg-card">
        <div className="min-w-0 flex-1 truncate font-semibold text-sm">{branch.label}</div>
      </div>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-white px-2.5 dark:bg-card"
          />
        }
      >
        <div className="min-w-0 flex-1 truncate font-semibold text-sm text-left">{branch.label}</div>
        <ChevronsUpDown className="size-3.5 opacity-60 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-[248px] p-1">
        <div className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{t("branch.choose")}</div>
        {branches.map((b) => {
          const active = branch.id === b.id;
          return (
            <button
              key={b.id}
              type="button"
              // Suara Dot sudah dimainkan oleh setBranch(); matikan suara
              // generik dari SoundLayer agar tidak dobel.
              data-sfx-silent
              onClick={() => {
                setBranch(b);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors",
                active ? "bg-foreground/[0.06] text-foreground" : "hover:bg-foreground/[0.04] text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="min-w-0 flex-1 truncate text-sm font-medium">{b.label}</div>
              {active && <CheckIcon className="size-4 text-primary shrink-0" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function SidebarContent({
  onNavigate,
  role,
  fullName,
  avatarUrl,
}: {
  onNavigate?: () => void;
  role: string;
  fullName: string | null;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { branch } = useBranch();
  const { activeOrgId } = useTenant();
  const t = useTranslations("nav");
  const canSwitchTenantValue = canSwitchTenant(role);
  const canSwitchBranchValue = canSwitchBranch(role);

  // Live count of in-progress servis for the badge (terminal states excluded).
  const [activeServisCount, setActiveServisCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      try {
        let query = supabase
          .from("cervise_services")
          .select("id", { count: "exact", head: true })
          .not("status", "in", '("Selesai","Sudah Diambil","Batal")');
        if (branch.id !== "all") query = query.eq("branch_id", branch.id);
        const { count, error } = await query;
        if (!cancelled && !error) setActiveServisCount(count ?? 0);
      } catch {
        if (!cancelled) setActiveServisCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branch.id, pathname]);
  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-border/60 bg-white px-2 dark:bg-card">
        <TenantSwitcher canSwitchTenant={canSwitchTenantValue} />
      </div>

      <div className="px-2 pt-2">
        <BranchSwitcher canSwitch={canSwitchBranchValue} />
      </div>

      <nav className="mt-3 flex-1 overflow-y-auto scrollbar-none px-2 pb-2">
        {navFor(role, "legacy").map((block) => {
          const groupKey = GROUP_LABEL_KEY[block.group];
          return (
            <div key={block.group} className="mt-3 first:mt-1">
              {groupKey ? <SectionLabel>{t(groupKey)}</SectionLabel> : null}
              <ul className="flex flex-col gap-0.5">
                {block.entries.map((entry) => {
                  const active =
                    pathname === entry.href ||
                    (entry.href !== "/app" && pathname.startsWith(entry.href));
                  const label = t(`items.${entry.key}`);
                  const badge = entry.href === "/app/servis" ? (activeServisCount ?? 0) : 0;
                  const Icon = entry.icon;
                  return (
                    <li key={entry.href}>
                      <Link
                        href={entry.href}
                        onClick={onNavigate}
                        className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                          active
                            ? "bg-foreground/[0.06] font-medium text-foreground"
                            : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="size-4 opacity-70" />
                          {label}
                        </span>
                        {badge ? (
                          <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px]">
                            {badge}
                          </Badge>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Trial card — live dari tenant_subscriptions; sembunyi bila bukan trial */}
      <TrialCard organizationId={activeOrgId} canManageSubscription={canAccess(role, "pengaturan_subscription")} />

      <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2.5">
        <IdentityAvatar photoUrl={avatarUrl} name={fullName ?? roleLabel(role)} className="size-8 text-xs" />
        <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{fullName ?? roleLabel(role)}</div>
          <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span className="truncate">{branch.label}</span>
          </div>
        </div>
        <SoundToggle />
        <button
          type="button"
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            router.push("/login");
            router.refresh();
          }}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-foreground/[0.04]"
          aria-label="Logout"
        >
          <LogOut className="size-4" />
        </button>
        <Link
          href="/app/pengaturan/profil"
          aria-label="Pengaturan profil"
          className={`rounded-md p-1.5 ${pathname.startsWith("/app/pengaturan") ? "bg-foreground/[0.06] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04]"}`}
        >
          <Settings className="size-4" />
        </Link>
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

type BottomTab = { key: string; label: string; href?: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; isCenter?: boolean; badge?: number };

const BOTTOM_TABS: BottomTab[] = [
  { key: "dashboard", label: "Beranda", href: "/app", icon: HomeIcon },
  { key: "servis", label: "Servis", href: "/app/servis", icon: Wrench },
  { key: "create", label: "Tambah", href: "/app/servis/baru", icon: PlusIcon, isCenter: true },
  { key: "inventory", label: "Inventori", href: "/app/inventori", icon: Package },
  { key: "lainnya", label: "Lainnya", icon: Settings },
];

/**
 * Tab yang punya `href` hanya dirender bila role boleh membukanya. Tanpa ini
 * bottom-nav akan menampilkan tautan yang sidebar menyembunyikan.
 * `/app/servis/baru` adalah halaman anak, bukan entri manifest, jadi
 * kelayakannya mengikuti `/app/servis`.
 */
function bottomTabsForRole(role: string): BottomTab[] {
  return BOTTOM_TABS.filter((tab) => {
    if (tab.key === "lainnya") return true;
    if (tab.key === "create") return canAccess(role, "/app/servis");
    return canAccess(role, tab.href ?? "");
  });
}

function bottomTabKey(key: string): string {
  switch (key) {
    case "dashboard":
      return "bottomTabs.home";
    case "servis":
      return "bottomTabs.service";
    case "create":
      return "bottomTabs.add";
    case "inventory":
      return "bottomTabs.inventory";
    case "lainnya":
      return "bottomTabs.more";
    default:
      return key;
  }
}
function CerviseBottomNav({ pathname, role }: { pathname: string; role: string }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const t = useTranslations("nav");
  const tabs = bottomTabsForRole(role);
  return (
    <>
      <nav className="h-[72px] border-t border-border/60 bg-background flex items-stretch justify-around relative shrink-0 sticky bottom-0 z-30 lg:hidden safe-area-pb">
        {tabs.map((tab) => {
          const isActive = tab.href ? pathname === tab.href || (tab.href !== "/app" && pathname.startsWith(tab.href)) : false;
          const isCenter = !!tab.isCenter;
          const label = t(bottomTabKey(tab.key));
          if (tab.key === "lainnya") {
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-label={label}
                className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 cursor-pointer transition-colors text-muted-foreground"
              >
                <tab.icon className="size-5" strokeWidth={2} />
                <span className="text-[10px]">{label}</span>
              </button>
            );
          }
          if (isCenter) {
            return (
              <Link
                key={tab.key}
                href={tab.href!}
                aria-label={label}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 cursor-pointer"
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-foreground text-background -translate-y-3 shadow-md">
                  <PlusIcon className="size-5" />
                </span>
                <span className={`text-[10px] -mt-2 ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
              </Link>
            );
          }
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={tab.href!}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              // Ganti tab navigasi → undo.wav. Tab aktif diklik ulang: hening.
              onClick={() => {
                if (!isActive) sfx.tab();
              }}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 cursor-pointer transition-colors ${isActive ? "text-foreground" : "text-muted-foreground"}`}
            >
              {isActive ? <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-foreground" /> : null}
              <span className="relative">
                <Icon className="size-5" strokeWidth={isActive ? 2.4 : 2} />
                {tab.badge ? (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-foreground text-background text-[9px] font-medium flex items-center justify-center">
                    {tab.badge}
                  </span>
                ) : null}
              </span>
              <span className="text-[10px]">{label}</span>
            </Link>
          );
        })}
      </nav>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-auto">
          <div className="grid grid-cols-3 gap-2 pt-2 pb-6">
            {navFor(role, "legacy").map((block) =>
              block.entries.map((entry) => {
                const Icon = entry.icon;
                return (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    onClick={() => setSheetOpen(false)}
                    className="flex flex-col items-center gap-2 rounded-lg border p-3 text-xs"
                  >
                    <Icon className="size-5" />
                    {t(`items.${entry.key}`)}
                  </Link>
                );
              }),
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export type AppShellActor = {
  role: string;
  orgId: string;
  branchId: string | null;
  /** Identitas akun untuk sidebar. null = belum diketahui / belum diisi. */
  fullName: string | null;
  avatarUrl: string | null;
  /** Cabang aktif milik organisasi; hanya diisi untuk MASTER_ADMIN. */
  branches?: BranchOption[] | null;
  /** Scope server: `all` atau id cabang. Dipakai agar label tidak berkedip. */
  branchScope?: string | null;
};

function AppShellInner({ children, actor }: { children: React.ReactNode; actor: AppShellActor }) {
  const [open, setOpen] = useState(false);
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
        <SidebarContent role={actor.role} fullName={actor.fullName} avatarUrl={actor.avatarUrl} />
      </aside>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:col-start-2">
        <div className="lg:hidden sticky top-0 z-40 flex h-16 shrink-0 items-center justify-start gap-2 border-b border-border/60 bg-background px-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
              <Wrench className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
              <SheetHeader className="sr-only">
                <SheetTitle>Menu Cervise</SheetTitle>
              </SheetHeader>
              <SidebarContent
                role={actor.role}
                fullName={actor.fullName}
                avatarUrl={actor.avatarUrl}
                onNavigate={() => setOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 font-semibold text-sm">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">C</span>
            Cervise
          </div>
        </div>

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

        <CerviseBottomNav pathname={pathname} role={actor.role} />
      </div>
    </div>
  );
}

export function AppShell({ children, actor }: { children: React.ReactNode; actor: AppShellActor }) {
  const canSwitch = isMasterAdminRole(actor.role);
  return (
    <LocaleProvider>
      <TenantProvider fixedOrganizationId={canSwitch ? null : actor.orgId}>
        <BranchProvider
          fixedBranchId={canSwitch ? null : actor.branchId ?? "unassigned"}
          initialBranches={actor.branches ?? null}
          initialScope={actor.branchScope ?? null}
        >
          <CommandPaletteProvider role={actor.role}>
            <AppShellInner actor={actor}>{children}</AppShellInner>
          </CommandPaletteProvider>
        </BranchProvider>
      </TenantProvider>
    </LocaleProvider>
  );
}
