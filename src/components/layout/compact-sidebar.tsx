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

/**
 * Grup yang dirender di rail compact. `dashboard` masuk supaya teknisi dan
 * frontliner bisa kembali ke dashboard tanpa tombol khusus.
 */
const COMPACT_GROUPS = ["dashboard", "operasional", "laporan", "keuangan"] as const;

/**
 * Lebar rail untuk `grid-template-columns`.
 *
 * 70px, diminta langsung. Padding nav memakai px-1 (4px per sisi) sehingga
 * 62px tersisa untuk isi item -- cukup untuk ikon 18px dan label "Analistik"
 * satu kata pada text-[9px].
 */
export const COMPACT_RAIL_WIDTH = "70px";

/**
 * Template kolom grid shell: rail tetap, sisanya untuk konten.
 *
 * Rail HARUS panjang tetap (`70px`), bukan `auto` dan bukan pecahan. Dengan
 * `auto`, kolom ikut menyerap sisa ruang — jadi rail melebar persis saat
 * main pane melebar.
 *
 * Kolom kedua `minmax(0, 1fr)`, bukan `1fr`. `1fr` punya batas bawah otomatis
 * sebesar min-content, jadi tabel atau teks panjang di konten bisa mendorong
 * grid melebihi lebar layar dan membuat halaman bisa di-scroll horizontal.
 * `minmax(0, 1fr)` mengizinkan kolom menyusut ke nol.
 *
 * Tidak ada prefix `lg` di sini. Prefix breakpoint (`lg:`) hanya berlaku di
 * nama kelas Tailwind; di inline style `lg` hanya token tak dikenal, dan
 * browser membuang seluruh deklarasi lalu membiarkan kolom fallback ke `auto`.
 */
export const COMPACT_GRID_TEMPLATE = `${COMPACT_RAIL_WIDTH} minmax(0, 1fr)`;

export type CompactSidebarProps = {
  role: string;
  fullName: string | null;
  avatarUrl: string | null;
  onNavigate?: () => void;
  /**
   * Tampilkan nama menu di bawah ikon.
   *
   * Default true: rail 74px cukup untuk label dua baris, dan label di bawah
   * ikon lebih terbaca daripada tooltip yang hanya muncul saat hover.
   */
  showLabels?: boolean;
};

export function CompactSidebar({
  role,
  fullName,
  avatarUrl,
  onNavigate,
  showLabels = true,
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
      <div className="flex justify-center px-1 pt-3 pb-2">
        <TenantLogo
          logoUrl={tenantLogo}
          name={tenantName}
          title={[tenantName, branch.label].filter(Boolean).join(" · ") || "Cervise"}
        />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto scrollbar-none px-1 pb-2">
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

      <div className="flex flex-col items-center gap-0.5 border-t border-border/60 px-1 py-1.5">
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
        title={showLabel ? undefined : label}
        className={cn(
          // Ukuran tetap, bukan `aspect-square`: di rail sempit kotak
          // kuadrat ikut melebar dan tiap item jadi setinggi lebar rail.
          "flex w-full items-center justify-center rounded-lg transition-colors",
          showLabel ? "flex-col gap-0.5 py-1.5" : "h-11",
          active
            ? "bg-foreground/[0.08] text-foreground"
            : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
        )}
      >
        <Icon
          // `fill="currentColor"` hanya di rail compact. Ikon Lucide secara
          // default hanya garis; di rail setipis ini garis 2px kehilangan
          // detail dan ikon jadi samar, terutama saat tidak aktif. Mengisi
          // path membuat siluetnya tegas di 18px.
          fill="currentColor"
          className={cn("size-[18px] shrink-0", active ? "opacity-100" : "opacity-70")}
        />
        {showLabel ? (
          // Tiga baris, bukan dua. Di rail 60px dengan padding px-1 hanya
          // 52px yang tersisa, dan "Analitik Servis" butuh tiga baris
          // ("Analitik / Servis" pada dua baris masih terpotong). Font
          // diturunkan ke 9px supaya "Analitik" muat satu baris utuh.
          <span className="line-clamp-3 max-w-full text-center text-[9px] leading-[1.15]">
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
