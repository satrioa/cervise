"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { IdentityAvatar } from "@/components/identity-avatar";
import { TenantLogo } from "@/components/layout/tenant-logo";
import { useBranch } from "@/lib/branch-context";
import { useTenant } from "@/lib/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { normalizeAppRole } from "@/lib/nav/manifest";

/**
 * Dua pil mengambang di bawah layar, seperti frame Figma:
 * kiri identitas tenant + cabang, kanan identitas pengguna + aksi akun.
 *
 * Pil ini menggantikan footer rail 70px. Di layar sempit teks nama
 * disembunyikan agar dua pil tetap muat tanpa saling menimpa.
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

  const tenant =
    tenants.find((item) => item.id === activeOrgId) ??
    (tenants.length === 1 ? tenants[0] : null);
  const tenantName = tenant?.name ?? "Cervise";
  const branchLabel = branch?.label ?? null;
  const normalized = normalizeAppRole(role);
  const roleLabel =
    normalized === "TECHNICIAN"
      ? "Teknisi"
      : normalized === "FRONTLINER"
        ? "Frontliner"
        : (normalized ?? "Anggota");

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4 lg:px-8">
      <div className="flex w-full items-center justify-between gap-2">
        <div className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-full bg-white p-1.5 pr-2 shadow-[0_16px_38px_-24px_rgba(0,0,0,0.55)] ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10 sm:pr-3">
          <TenantLogo
            logoUrl={tenant?.logoUrl ?? null}
            name={tenantName}
            title={tenantName}
            className="size-9 rounded-full bg-neutral-900 text-[11px] font-semibold text-white dark:bg-white dark:text-neutral-900"
          />
          <span className="hidden max-w-[9rem] truncate text-sm font-medium sm:inline">
            {tenantName}
          </span>
          {branchLabel ? (
            <span className="max-w-[8rem] truncate rounded-full bg-[#2563EB] px-2.5 py-1 text-[10px] font-medium text-white sm:text-[11px]">
              {branchLabel}
            </span>
          ) : null}
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-1 rounded-full bg-white p-1.5 shadow-[0_16px_38px_-24px_rgba(0,0,0,0.55)] ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
          <IdentityAvatar
            photoUrl={avatarUrl}
            name={fullName ?? "?"}
            className="size-9 bg-neutral-900 text-[11px] text-white dark:bg-white dark:text-neutral-900"
          />
          <span className="hidden max-w-[10rem] truncate pl-1 text-sm font-medium md:inline">
            {fullName ?? "Pengguna"}
            <span className="ml-1 text-[11px] font-normal text-muted-foreground">{roleLabel}</span>
          </span>
          <LogoutButton />
          <Link
            href="/app/pengaturan/profil"
            aria-label="Pengaturan profil"
            title="Pengaturan profil"
            className="flex size-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <Settings className="size-[18px]" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      aria-label="Keluar"
      title="Keluar"
      className="flex size-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
    >
      <LogOut className="size-[18px]" />
    </button>
  );
}
