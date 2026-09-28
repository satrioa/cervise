"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { useTenant } from "@/lib/tenant-context";
import { useBranch } from "@/lib/branch-context";
import { createClient } from "@/lib/supabase/client";
import { IdentityAvatar } from "@/components/identity-avatar";
import { GROUP_LABEL_KEY, navFor, type NavEntry } from "@/lib/nav/manifest";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Sidebar shell compact untuk TEKNICIAN (dan FRONTLINER di Spec 3).
 *
 * Berbeda dari `app-shell.tsx` dalam tiga hal yang diminta:
 *   1. Item tersusun vertikal — icon di atas label, bukan satu baris.
 *   2. Ikon lebih besar: size-4 -> size-[18px], dan padding item lebih lega.
 *   3. Branch switcher tidak ada. `BranchProvider` sudah mengunci cabang untuk
 *      non-MASTER_ADMIN, jadi yang ditampilkan hanyalah baris teks informasi.
 *
 * Daftar menu tidak ditulis di sini — `navFor(role, "compact")` yang
 * cemented, jadi menambah halaman cukup menambah entri di manifest.
 *
 * `TrialCard` sengaja tidak dirender: kartu itu menampilkan status trial
 * subscription, dan teknisi tidak punya aksi apa pun terhadapnya.
 */

const COMPACT_GROUPS = ["operasional", "laporan", "keuangan"] as const;

export type CompactSidebarProps = {
  role: string;
  fullName: string | null;
  avatarUrl: string | null;
  onNavigate?: () => void;
};

export function CompactSidebar({ role, fullName, avatarUrl, onNavigate }: CompactSidebarProps) {
  const pathname = usePathname();
  const { tenants, activeOrgId } = useTenant();
  const { branch } = useBranch();
  const t = useTranslations("nav");

  const tenantName =
    tenants.find((tenant) => tenant.id === activeOrgId)?.name ??
    (tenants.length === 1 ? tenants[0]?.name : null);

  const blocks = navFor(role, "compact")
    .filter((block) => (COMPACT_GROUPS as readonly string[]).includes(block.group))
    .map((block) => ({
      ...block,
      label: GROUP_LABEL_KEY[block.group],
    }));

  return (
    <>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
            C
          </span>
          <span className="font-semibold">Cervise</span>
        </div>
        <div className="mt-3 min-w-0">
          <div className="truncate text-sm font-medium">{tenantName ?? "Cervise"}</div>
          {/* Baris informasi cabang — menggantikan BranchSwitcher, yang tidak
              boleh tampil untuk role non-MASTER_ADMIN. */}
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{branch.label}</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-none px-3 pb-3">
        {blocks.map((block) => (
          <div key={block.group} className="mt-4 first:mt-1">
            {block.label ? (
              <div className="px-1 pb-1.5 font-mono text-[9px] text-muted-foreground/70 uppercase tracking-[0.25em]">
                {t(block.label)}
              </div>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {block.entries.map((entry) => (
                <CompactNavLink
                  key={entry.href}
                  entry={entry}
                  active={isActive(pathname, entry.href)}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2.5">
        <IdentityAvatar photoUrl={avatarUrl} name={fullName ?? "?"} className="size-8 text-xs" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{fullName ?? "Akun"}</div>
          <div className="truncate text-xs text-muted-foreground">{branch.label}</div>
        </div>
        <Link
          href="/app/pengaturan/profil"
          aria-label="Pengaturan profil"
          onClick={onNavigate}
          className={cn(
            "rounded-md p-1.5 text-muted-foreground hover:bg-foreground/[0.04]",
            pathname.startsWith("/app/pengaturan") && "bg-foreground/[0.06] text-foreground",
          )}
        >
          <Settings className="size-4" />
        </Link>
        <LogoutButton />
      </div>
    </>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function CompactNavLink({
  entry,
  active,
  onNavigate,
}: {
  entry: NavEntry;
  active: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const Icon = entry.icon;
  return (
    <li>
      <Link
        href={entry.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-col items-center gap-1.5 rounded-lg px-3 py-2.5 transition-colors",
          active
            ? "bg-foreground/[0.06] text-foreground"
            : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
        )}
      >
        <Icon className="size-[18px] opacity-70" />
        <span className="text-center text-xs leading-tight">{t(`items.${entry.key}`)}</span>
      </Link>
    </li>
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
      className="rounded-md p-1.5 text-muted-foreground hover:bg-foreground/[0.04]"
    >
      <LogOut className="size-4" />
    </button>
  );
}
