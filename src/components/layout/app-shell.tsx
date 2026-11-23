"use client";

import { ChevronsUpDown, LayoutGrid, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { sfx } from "@/lib/sound";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommandPaletteProvider } from "@/components/layout/command-palette-provider";
import { ShellRoleProvider } from "@/components/layout/shell-chrome";
import { canAccessActor } from "@/lib/nav/manifest";
import { PageTransition } from "@/components/layout/page-transition";
import { PullToRefreshIndicator, usePullToRefresh } from "@/components/layout/pull-to-refresh";
import { BranchProvider, useBranch } from "@/lib/branch-context";
import { TenantProvider, useTenant } from "@/lib/tenant-context";
import { TrialCard } from "@/components/layout/trial-card";
import { SoundToggle } from "@/components/layout/sound-toggle";
import { GROUP_LABEL_KEY, navFor } from "@/lib/nav/manifest";
import { LocaleProvider } from "@/lib/localization-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MultipleAccounts, type AccountOption } from "@/components/uitripled/multiple-accounts-shadcnui";
import { IdentityAvatar } from "@/components/identity-avatar";
import { TenantLogo } from "@/components/layout/tenant-logo";
import { AsciiPage } from "@/components/layout/ascii-page";
import { Skeleton } from "@/components/ui/skeleton";
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

/** Kode paket lama masih tersimpan di organizations.paket; tampilkan nama saat ini. */
const PAKET_LABEL: Record<string, string> = {
  trial: "Trial",
  starter: "Starter",
  business: "Business",
  custom: "Custom",
  basic: "Starter",
  pro: "Business",
};

function paketLabel(paket: string | null | undefined): string {
  const key = (paket ?? "").trim().toLowerCase();
  return PAKET_LABEL[key] ?? (key ? paket! : "Trial");
}

function TenantSwitcher({ canSwitchTenant: canSwitchTenantValue }: { canSwitchTenant: boolean }) {
  const router = useRouter();
  const { tenants, activeOrgId, setActiveOrg, loading, isPlatformAdmin } = useTenant();
  if (loading) {
    return (
      <div className="flex w-full items-center gap-2.5 px-3.5 py-2" aria-hidden>
        <Skeleton className="size-8 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-2 w-20" />
          <Skeleton className="mt-1.5 h-3.5 w-32" />
        </div>
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
    plan: paketLabel(tenant.paket),
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
      // staff Kaggo) mengkliknya dan dihantarkan ke layar login - padahal
      // session-nya masih hidup. onManage opsional di MultipleAccounts, jadi
      // tidak meneruskannya sudah cukup untuk menyembunyikan tombol.
      {...(isPlatformAdmin
        ? { onManage: () => router.push("/owner/new"), manageLabel: "Buat Tenant Baru" }
        : {})}
      bare
    />
  );
}

function BranchSwitcher({ canSwitch, compact = false }: { canSwitch: boolean; compact?: boolean }) {
  const { branch, setBranch, branches } = useBranch();
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const shellClass = compact
    ? "flex h-8 max-w-[150px] items-center gap-1.5 rounded-full border border-border/60 bg-white px-2.5 text-xs dark:bg-card"
    : "flex h-12 w-full items-center rounded-xl border border-border/60 bg-white px-2.5 dark:bg-card";
  if (!canSwitch) {
    return (
      <div className={shellClass}>
        <div className="min-w-0 flex-1 truncate font-semibold text-sm">{branch.label}</div>
      </div>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<button type="button" className={cn(shellClass, "justify-between")} />}
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
  permissions,
  fullName,
  avatarUrl,
}: {
  onNavigate?: () => void;
  role: string;
  permissions?: readonly string[] | null;
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
  const accountActive = pathname.startsWith("/app/pengaturan/profil");
  const tenantSettingsActive =
    pathname.startsWith("/app/pengaturan") && !accountActive;
  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-border/60 bg-white px-2 dark:bg-[#0f0f0f]">
        <TenantSwitcher canSwitchTenant={canSwitchTenantValue} />
      </div>

      <div className="px-2 pt-2">
        <BranchSwitcher canSwitch={canSwitchBranchValue} />
      </div>

      <nav className="mt-3 flex-1 overflow-y-auto scrollbar-none px-2 pb-2">
        {navFor(role, "legacy", { permissions }).map((block) => {
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
      <TrialCard organizationId={activeOrgId} canManageSubscription={canAccessActor({ role, permissions }, "pengaturan_subscription")} />

      <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2.5">
        <Link
          href="/app/pengaturan/profil"
          aria-label="Pengaturan akun"
          title="Pengaturan akun"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 -ml-1 transition-colors",
            accountActive ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.04]",
          )}
        >
          <IdentityAvatar photoUrl={avatarUrl} name={fullName ?? roleLabel(role)} className="size-8 text-xs shrink-0" />
          <div className="min-w-0 flex-1 text-left">
            <div className="truncate text-sm font-medium">{fullName ?? roleLabel(role)}</div>
            <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span className="truncate">{branch.label}</span>
            </div>
          </div>
        </Link>
        <SoundToggle />
        <button
          type="button"
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.assign("/login");
          }}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-foreground/[0.04]"
          aria-label="Logout"
        >
          <LogOut className="size-4" />
        </button>
        <Link
          href="/app/pengaturan"
          aria-label="Pengaturan tenant"
          title="Pengaturan tenant"
          className={cn(
            "rounded-md p-1.5 transition-colors",
            tenantSettingsActive
              ? "bg-foreground/[0.06] text-foreground"
              : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
          )}
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

export type AppShellActor = {
  role: string;
  permissions?: readonly string[] | null;
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
  const { tenants, activeOrgId } = useTenant();
  const activeTenant = tenants.find((tenant) => tenant.id === activeOrgId) ?? tenants[0];
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const pull = usePullToRefresh(scrollRef, { onRefresh: () => window.location.reload() });

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
      <PageTransition />
      <aside className="hidden h-svh shrink-0 flex-col border-r border-border/60 bg-foreground/[0.02] lg:flex sticky top-0 overflow-hidden">
        <SidebarContent role={actor.role} permissions={actor.permissions} fullName={actor.fullName} avatarUrl={actor.avatarUrl} />
      </aside>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:col-start-2">
        <div className="lg:hidden sticky top-0 z-40 flex h-16 shrink-0 items-center justify-start gap-2 border-b border-border/60 bg-background px-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
              <LayoutGrid className="size-5" fill="currentColor" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
              <SheetHeader className="sr-only">
                <SheetTitle>Menu Kaggo</SheetTitle>
              </SheetHeader>
              <SidebarContent
                role={actor.role}
                permissions={actor.permissions}
                fullName={actor.fullName}
                avatarUrl={actor.avatarUrl}
                onNavigate={() => setOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <div className="flex min-w-0 items-center gap-2 font-semibold text-sm">
            <TenantLogo
              logoUrl={activeTenant?.logoUrl}
              name={activeTenant?.name}
              title={`Tenant: ${activeTenant?.name ?? "Tenant"}`}
              className="size-7 text-xs"
            />
            <span className="truncate">{activeTenant?.name ?? "Kaggo"}</span>
          </div>
          <div className="ml-auto">
            <BranchSwitcher canSwitch={canSwitchBranch(actor.role)} compact />
          </div>
        </div>

        <PullToRefreshIndicator distance={pull.distance} refreshing={pull.refreshing} />
        <div
          ref={scrollRef}
          onScroll={updateFade}
          className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain scrollbar-none scroll-smooth"
        >
          {/* progressive blur — top */}
          <div
            aria-hidden
            className="pointer-events-none sticky top-0 z-10 -mb-8 h-8 bg-gradient-to-b from-background via-background/60 to-transparent backdrop-blur-[6px] [mask-image:linear-gradient(to_bottom,black_0%,black_35%,transparent_100%)] transition-opacity duration-300"
            style={{ opacity: showTopFade ? 1 : 0 }}
          />
          <div data-main-content className="min-h-full">
            <AsciiPage className="min-h-full">{children}</AsciiPage>
          </div>
          {/* progressive blur — bottom */}
          <div
            aria-hidden
            className="pointer-events-none sticky bottom-0 z-10 -mt-8 h-8 bg-gradient-to-t from-background via-background/60 to-transparent backdrop-blur-[6px] [mask-image:linear-gradient(to_top,black_0%,black_35%,transparent_100%)] transition-opacity duration-300"
            style={{ opacity: showBottomFade ? 1 : 0 }}
          />
        </div>

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
          <CommandPaletteProvider role={actor.role} permissions={actor.permissions}>
            <ShellRoleProvider value={actor.role}>
              <AppShellInner actor={actor}>{children}</AppShellInner>
            </ShellRoleProvider>
          </CommandPaletteProvider>
        </BranchProvider>
      </TenantProvider>
    </LocaleProvider>
  );
}
