"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutGrid, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { CommandSearchTrigger } from "@/components/layout/command-palette-provider";
import { TenantLogo } from "@/components/layout/tenant-logo";
import { labelFor, matchEntry } from "@/components/layout/page-breadcrumb";
import ProfileDropdown from "@/components/kokonutui/profile-dropdown";
import { useBranch } from "@/lib/branch-context";
import { useTenant } from "@/lib/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { normalizeAppRole, ROLE_LABEL } from "@/lib/nav/manifest";

/**
 * Bar identitas compact.
 *
 * Mobile: SATU header transparan di atas — logo tenant di kiri, judul halaman
 * di tengah, tombol grid berisi di kanan yang membuka drawer menu. Desktop:
 * bar mengambang di bawah seperti sebelumnya (tenant + cari + profil).
 */
export function CompactBottomBar({
  role,
  fullName,
  email,
  avatarUrl,
  onOpenMenu,
}: {
  role: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  onOpenMenu: () => void;
}) {
  const { tenants, activeOrgId } = useTenant();
  const { branch } = useBranch();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { theme: appTheme, setTheme } = useTheme();

  const tenant =
    tenants.find((item) => item.id === activeOrgId) ??
    (tenants.length === 1 ? tenants[0] : null);
  const tenantName = tenant?.name ?? "Kaggo";
  const branchLabel = branch?.label ?? null;
  const normalized = normalizeAppRole(role);
  const roleLabel = normalized ? ROLE_LABEL[normalized] : "Anggota";

  const entry = matchEntry(pathname);
  const tail = entry && pathname.startsWith(`${entry.href}/`)
    ? pathname.slice(entry.href.length).split("/").filter(Boolean)
    : [];
  const pageTitle =
    pathname === "/app"
      ? "Home"
      : tail.length > 0
        ? labelFor(tail[tail.length - 1])
        : (entry?.label ?? "Kaggo");

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-40 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6 lg:top-auto lg:bottom-0 lg:px-8 lg:pt-0 lg:pb-4"
      data-compact-bar=""
    >
      {/* Mobile: header transparan, judul di tengah, grid di kanan. */}
      <div className="relative lg:hidden">
        {/* Blur progresif di belakang navbar: konten yang lewat jadi blur
            bertahap, tanpa menambah lapisan gelap di atasnya. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-16 backdrop-blur-md [mask-image:linear-gradient(to_bottom,black_0%,black_45%,transparent_100%)]"
        />
        <div className="relative z-10 flex w-full items-center gap-2">
        <div className="pointer-events-auto shrink-0">
          <TenantLogo
            logoUrl={tenant?.logoUrl ?? null}
            name={tenantName}
            title={tenantName}
            className="size-8 rounded-full bg-white shadow-[0_16px_38px_-24px_rgba(0,0,0,0.55)] ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10"
          />
        </div>
        <h1 className="min-w-0 flex-1 truncate text-center text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {pageTitle}
        </h1>
        <button
          type="button"
          aria-label="Buka menu"
          title="Buka menu"
          onClick={onOpenMenu}
          className="pointer-events-auto flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-neutral-700 shadow-[0_16px_38px_-24px_rgba(0,0,0,0.55)] ring-1 ring-black/5 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-white/10"
        >
          <LayoutGrid fill="currentColor" className="size-[18px]" />
        </button>
        </div>
      </div>

      {/* Desktop: bar bawah berisi tenant, cari, dan profil. */}
      <div className="hidden w-full items-center gap-2 lg:flex">
        <div className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-full bg-white p-1.5 pr-2 shadow-[0_16px_38px_-24px_rgba(0,0,0,0.55)] ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10 sm:pr-3">
          <TenantLogo
            logoUrl={tenant?.logoUrl ?? null}
            name={tenantName}
            title={tenantName}
            className="size-6 rounded-full bg-neutral-900 text-[11px] font-semibold text-white dark:bg-white dark:text-neutral-900"
          />
          <span className="hidden max-w-[9rem] truncate text-sm font-medium sm:inline">
            {tenantName}
          </span>
          {branchLabel ? (
            <span data-branch-badge className="inline-block h-6 max-w-[8rem] truncate rounded-full bg-[#2563EB] px-2.5 text-[10px] font-medium leading-6 text-white sm:text-[11px]">
              {branchLabel}
            </span>
          ) : null}
        </div>

        <div className="pointer-events-auto ml-auto flex shrink-0 items-center gap-2">
          <CommandSearchTrigger
            aria-label={t("search.placeholder")}
            className="flex size-9 items-center justify-center rounded-full border-0 bg-white p-0 shadow-[0_16px_38px_-24px_rgba(0,0,0,0.55)] ring-1 ring-black/5 hover:bg-white dark:bg-neutral-900 dark:ring-white/10 dark:hover:bg-neutral-800 [&>kbd]:hidden"
          />

          <ProfileDropdown
            accounts={[
              {
                id: "staff",
                name: fullName ?? "Pengguna",
                email: email ?? "",
                avatarUrl,
                plan: roleLabel,
              },
            ]}
            defaultAccountId="staff"
            items={[
              {
                label: "Profil",
                icon: <UserRound className="size-4" />,
                href: "/app/pengaturan/profil",
              },
            ]}
            theme={appTheme === "light" || appTheme === "dark" ? appTheme : "system"}
            onThemeChange={(next) => setTheme(next)}
            onSignOut={() => {
              void (async () => {
                const supabase = createClient();
                await supabase.auth.signOut();
                router.push("/login");
                router.refresh();
              })();
            }}
            className="pointer-events-auto [&>button]:w-auto [&>button]:rounded-full [&>button]:border-black/5 [&>button]:bg-white [&>button]:p-1.5 [&>button]:pr-3 [&>button]:shadow-[0_16px_38px_-24px_rgba(0,0,0,0.55)] dark:[&>button]:border-white/10 dark:[&>button]:bg-neutral-900"
          />
        </div>
      </div>
    </div>
  );
}
