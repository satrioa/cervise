"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut, UserRound } from "lucide-react";
import { CommandSearchTrigger } from "@/components/layout/command-palette-provider";
import { IdentityAvatar } from "@/components/identity-avatar";
import { TenantLogo } from "@/components/layout/tenant-logo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBranch } from "@/lib/branch-context";
import { useTenant } from "@/lib/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { normalizeAppRole, ROLE_LABEL } from "@/lib/nav/manifest";

/**
 * Bar identitas: tenant + cabang, pencarian, profil.
 *
 * Di mobile bar ini menempel di ATAS layar (menggantikan header yang dihapus),
 * sementara di `lg` tetap mengambang di bawah seperti semula. Search ada di
 * tengah supaya terbaca sebagai pintu command palette, dan profil membuka
 * popover berisi tautan akun + keluar.
 */
export function CompactBottomBar({
  role,
  fullName,
  avatarUrl,
}: {
  role: string;
  fullName: string | null;
  avatarUrl: string | null;
}) {
  const { tenants, activeOrgId } = useTenant();
  const { branch } = useBranch();
  const router = useRouter();
  const t = useTranslations("nav");
  const [accountOpen, setAccountOpen] = useState(false);

  const tenant =
    tenants.find((item) => item.id === activeOrgId) ??
    (tenants.length === 1 ? tenants[0] : null);
  const tenantName = tenant?.name ?? "Cervise";
  const branchLabel = branch?.label ?? null;
  const normalized = normalizeAppRole(role);
  // Label dari map bersama, bukan rantai `if` lokal: role yang belum punya
  // label akan jatuh ke "Anggota", bukan diam-diam jadi "Teknisi".
  const roleLabel = normalized ? ROLE_LABEL[normalized] : "Anggota";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6 lg:top-auto lg:bottom-0 lg:px-8 lg:pt-0 lg:pb-4">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="pointer-events-auto flex min-w-0 items-center gap-2 justify-self-start rounded-full bg-white p-1.5 pr-2 shadow-[0_16px_38px_-24px_rgba(0,0,0,0.55)] ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10 sm:pr-3">
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
            <span className="inline-block h-6 max-w-[8rem] truncate rounded-full bg-[#2563EB] px-2.5 text-[10px] font-medium leading-6 text-white sm:text-[11px]">
              {branchLabel}
            </span>
          ) : null}
        </div>

        <CommandSearchTrigger
          aria-label={t("search.placeholder")}
          className="pointer-events-auto flex size-9 items-center justify-center rounded-full border-0 bg-white p-0 shadow-[0_16px_38px_-24px_rgba(0,0,0,0.55)] ring-1 ring-black/5 hover:bg-white lg:hidden dark:bg-neutral-900 dark:ring-white/10 dark:hover:bg-neutral-800 [&>kbd]:hidden"
        />

        <div className="pointer-events-auto justify-self-end rounded-full bg-white p-1.5 shadow-[0_16px_38px_-24px_rgba(0,0,0,0.55)] ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
          <Popover open={accountOpen} onOpenChange={setAccountOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label="Menu akun"
                  className="flex items-center gap-1 rounded-full text-left"
                />
              }
            >
              <IdentityAvatar
                photoUrl={avatarUrl}
                name={fullName ?? "?"}
                className="size-6 bg-neutral-900 text-[11px] text-white dark:bg-white dark:text-neutral-900"
              />
              <span className="hidden max-w-[10rem] pl-1 md:block">
                <span className="block truncate text-[11px] font-medium leading-none">
                  {fullName ?? "Pengguna"}
                </span>
                <span className="mt-0.5 block truncate text-[9px] leading-none text-muted-foreground">
                  {roleLabel}
                </span>
              </span>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-56 p-1">
              <div className="px-2.5 py-2">
                <p className="truncate text-sm font-medium">{fullName ?? "Pengguna"}</p>
                <p className="text-[11px] text-muted-foreground">{roleLabel}</p>
              </div>
              <Link
                href="/app/pengaturan/profil"
                onClick={() => setAccountOpen(false)}
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
              >
                <UserRound className="size-4" />
                Profil
              </Link>
              <button
                type="button"
                onClick={async () => {
                  setAccountOpen(false);
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  router.push("/login");
                  router.refresh();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="size-4" />
                Keluar
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
