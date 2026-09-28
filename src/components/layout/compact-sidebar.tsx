"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { useTenant } from "@/lib/tenant-context";
import { useBranch } from "@/lib/branch-context";
import { createClient } from "@/lib/supabase/client";
import { IdentityAvatar } from "@/components/identity-avatar";
import { initialsOf } from "@/lib/photos";
import { GROUP_LABEL_KEY, navFor, type NavEntry } from "@/lib/nav/manifest";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Sidebar shell compact untuk TEKNICIAN dan FRONTLINER.
 *
 * Bentuknya rail ikon, bukan daftar dengan label. Alasannya: shell ini
 * dipakai orang yang sedang bekerja di lapangan dengan satu tangan, jadi
 * targetnya ruang klik yang nyaman tanpa memakan lebar layar. Label pindah
 * ke `title` (tooltip native) supaya nama menu tetap bisa dibaca.
 *
 * Berbeda dari `app-shell.tsx`:
 *   1. Rail sempit dengan ikon 18px, bukan baris `size-4`.
 *   2. Branch switcher tidak ada. `BranchProvider` sudah mengunci cabang untuk
 *      role non-MASTER_ADMIN; nama tenant dan cabang muncul di tooltip logo.
 *   3. Group dipisahkan garis tipis, bukan label — label tidak muat di rail.
 *
 * Daftar menu tidak ditulis di sini — `navFor(role, "compact")` yang
 * menentukan, jadi menambah halaman cukup menambah entri di manifest.
 *
 * `TrialCard` sengaja tidak dirender: kartu itu menampilkan status trial
 * subscription, dan teknisi maupun frontliner tidak punya aksi apa pun
 * terhadapnya.
 */

const COMPACT_GROUPS = ["operasional", "laporan", "keuangan"] as const;

/**
 * Lebar rail untuk `grid-template-columns`.
 *
 * Dipakai `clamp()`, bukan angka tetap. Rail 72px yang lama tetap — yang
 * berubah hanya proporsinya terhadap layar: saat board kanban digeser
 * horizontal, konten melebar dan rail terlihat jauh lebih kecil. Angka tetap
 * tidak pernah menangkap perasaan itu, karena pixel-nya sendiri tidak bergerak.
 *
 * Rentang 56px-72px dipilih supaya dua hal tetap berlaku di layar mana pun:
 *   - 56px masih memuat item dengan padding 8px per sisi.
 *   - Di bawah 56px, ikon mulai terasa sempit untuk disentuh.
 */
export const COMPACT_RAIL_WIDTH = "clamp(56px, 4.2vw, 72px)";

export type CompactSidebarProps = {
  role: string;
  fullName: string | null;
  avatarUrl: string | null;
  onNavigate?: () => void;
  /**
   * Tampilkan nama menu di bawah ikon.
   *
   * Di desktop label tidak dipakai — rail tidak memuatnya, dan `title`
   * sudah cukup. Di sheet mobile label wajib: perangkat sentuh tidak punya
   * hover, jadi tooltip native tidak akan pernah terlihat.
   */
  showLabels?: boolean;
};

export function CompactSidebar({
  role,
  fullName,
  avatarUrl,
  onNavigate,
  showLabels = false,
}: CompactSidebarProps) {
  const pathname = usePathname();
  const { tenants, activeOrgId } = useTenant();
  const { branch } = useBranch();

  const tenantName =
    tenants.find((tenant) => tenant.id === activeOrgId)?.name ??
    (tenants.length === 1 ? tenants[0]?.name : null);
  const tenantLogo = tenants.find((tenant) => tenant.id === activeOrgId)?.logoUrl ?? null;

  const blocks = navFor(role, "compact")
    .filter((block) => (COMPACT_GROUPS as readonly string[]).includes(block.group))
    .map((block) => ({
      ...block,
      label: GROUP_LABEL_KEY[block.group],
    }));

  return (
    <>
      {/* Di rail sempit tidak ada tempat untuk nama tenant dan cabang di bawah
          logo, jadi keduanya pindah ke sini. Ini yang menggantikan baris
          "Tenant assigned" dan baris info cabang yang diminta hilang. */}
      <div className="flex justify-center px-2 pt-3.5 pb-2.5">
        <TenantLogo
          logoUrl={tenantLogo}
          name={tenantName}
          title={[tenantName, branch.label].filter(Boolean).join(" · ") || "Cervise"}
        />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto scrollbar-none px-2 pb-2">
        {blocks.map((block) => (
          <div key={block.group} className="flex w-full flex-col items-center gap-0.5">
            {/* Pemisah antar group menggantikan label yang tidak muat di rail sempit. */}
            {block.label ? <div className="my-1.5 h-px w-5 bg-border/60" /> : null}
            <ul className="flex w-full flex-col items-center gap-0.5">
              {block.entries.map((entry) => (
                <CompactNavLink
                  key={entry.href}
                  entry={entry}
                  active={isActive(pathname, entry.href)}
                  onNavigate={onNavigate}
                  showLabel={showLabels}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex flex-col items-center gap-0.5 border-t border-border/60 px-2 py-2">
        <Link
          href="/app/pengaturan/profil"
          aria-label="Profil"
          onClick={onNavigate}
          title={fullName ? `${fullName} · ${branch.label}` : "Profil"}
          className={cn(
            "flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-foreground/[0.04]",
            pathname.startsWith("/app/pengaturan") && "bg-foreground/[0.06] text-foreground",
          )}
        >
          <IdentityAvatar photoUrl={avatarUrl} name={fullName ?? "?"} className="size-7 text-[11px]" />
        </Link>
        <Link
          href="/app/pengaturan/profil"
          aria-label="Pengaturan"
          title="Pengaturan"
          onClick={onNavigate}
          className={cn(
            "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground",
            pathname.startsWith("/app/pengaturan") && "text-foreground",
          )}
        >
          <Settings className="size-[18px]" />
        </Link>
        <LogoutButton />
      </div>
    </>
  );
}

/**
 * Logo tenant di kepala rail.
 *
 * Dipakai `next/image`, bukan `IdentityAvatar`, karena bentuknya persegi
 * (rounded-lg) untuk logo — `IdentityAvatar` hardcode `rounded-full` yang
 * memang benar untuk foto orang tapi terlihat salah untuk logo perusahaan.
 *
 * Kalau tenant belum mengunggah logo, jatuh ke inisial nama tenant, sama
 * seperti `IdentityAvatar` melakukan untuk foto orang. Tidak ada panggilan ke
 * layanan avatar pihak ketiga.
 */
function TenantLogo({
  logoUrl,
  name,
  title,
  className,
}: {
  logoUrl: string | null;
  name: string | null;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(logoUrl) && !failed;

  return (
    <span
      title={title}
      className={cn(
        "relative flex shrink-0 cursor-default items-center justify-center overflow-hidden rounded-lg bg-muted font-medium text-muted-foreground",
        className ?? "size-8 text-xs",
      )}
    >
      {showLogo ? (
        <Image
          src={logoUrl as string}
          alt={name ?? "Logo tenant"}
          fill
          sizes="32px"
          unoptimized
          onError={() => setFailed(true)}
          className="object-contain"
        />
      ) : (
        initialsOf(name ?? "C")
      )}
    </span>
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
  showLabel = false,
}: {
  entry: NavEntry;
  active: boolean;
  onNavigate?: () => void;
  showLabel?: boolean;
}) {
  const t = useTranslations("nav");
  const Icon = entry.icon;
  const label = t(`items.${entry.key}`);
  return (
    <li className="w-full">
      <Link
        href={entry.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        // Rail sempit hanya muat icon, jadi label dipindah ke `title`. Di sheet
        // mobile label ikut ditampilkan karena perangkat sentuh tidak punya
        // hover — tooltip native tidak akan pernah terlihat.
        title={showLabel ? undefined : label}
        className={cn(
          // Ukuran tetap, bukan `aspect-square`: di rail sempit kotak
          // kuadrat ikut melebar dan tiap item jadi setinggi lebar rail.
          // 48px masih di atas ambang target sentuh, dan seluruh rail jadi
          // muat layar tanpa scroll.
          "flex w-full items-center justify-center rounded-lg transition-colors",
          showLabel ? "flex-col gap-1 py-1.5" : "h-11",
          active
            ? "bg-foreground/[0.08] text-foreground"
            : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
        )}
      >
        <Icon className={cn("size-[18px] shrink-0", active ? "opacity-100" : "opacity-70")} />
        {showLabel ? (
          <span className="max-w-full truncate px-1 text-center text-[11px] leading-tight">
            {label}
          </span>
        ) : (
          <span className="sr-only">{label}</span>
        )}
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
      title="Keluar"
      className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
    >
      <LogOut className="size-[18px]" />
    </button>
  );
}
