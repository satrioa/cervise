"use client";

import { BarChart3, LayoutGrid, Printer, Sun, Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { MenuSection } from "@/components/layout/menu-section";
import { MenuOperational } from "@/components/layout/menu-operational";
import { MenuAnalytic } from "@/components/layout/menu-analytic";
import { MenuPreferences } from "@/components/layout/menu-preferences";
import { MenuSound } from "@/components/layout/menu-sound";
import { PrinterSettings } from "@/components/pengaturan/printer-card";
import { AppImage } from "@/components/ui/app-image";
import { useEffect, useRef, useState, type TouchEvent } from "react";
import { UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { CommandSearchTrigger } from "@/components/layout/command-palette-provider";
import { TenantLogo } from "@/components/layout/tenant-logo";
import ProfileDropdown from "@/components/kokonutui/profile-dropdown";
import { useBranch } from "@/lib/branch-context";
import { useTenant } from "@/lib/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { normalizeAppRole, ROLE_LABEL } from "@/lib/nav/manifest";

/**
 * Isi drawer menu untuk TECHNICIAN dan FRONTLINER.
 *
 * Bentuknya empat section collapsible, bukan satu daftar flat:
 *   1. Operasional  - kartu semua halaman yang boleh dibuka role ini (default terbuka)
 *   2. Analytic Servis - ringkasan 30 hari + tautan ke halaman analitik
 *   3. System Preferences - tema dan bahasa
 *   4. Sound System - mute dan volume nada UI
 *
 * Tidak ada tombol tutup di header. Menutup drawer lewat Esc atau tap backdrop
 * (perilaku `Dialog` Base UI); ikon `+`/`-` di tiap section adalah toggle
 * section itu sendiri, bukan aksi tutup. `SheetTitle` tetap dipasang tapi
 * `sr-only` karena Dialog membutuhkannya untuk nama aksesibel.
 *
 * Section boleh terbuka bersamaan; yang default terbuka hanya Operasional.
 */

/** Aksi cepat yang diketik bergantian di searchbar mobile. */
const QUICK_PROMPTS = [
  "Tambah data servis",
  "Tambah stok produk",
  "SRV-2029-***",
] as const;

function useTypewriter(phrases: readonly string[], enabled: boolean) {
  const [state, setState] = useState({ index: 0, text: "", deleting: false });

  useEffect(() => {
    if (!enabled || phrases.length === 0) return;
    const { index, text, deleting } = state;
    const phrase = phrases[index % phrases.length];

    let delay = 70;
    let next: () => void;
    if (!deleting && text.length < phrase.length) {
      next = () => setState((s) => ({ ...s, text: phrase.slice(0, s.text.length + 1) }));
    } else if (!deleting) {
      delay = 1400;
      next = () => setState((s) => ({ ...s, deleting: true }));
    } else if (text.length > 0) {
      delay = 35;
      next = () => setState((s) => ({ ...s, text: s.text.slice(0, -1) }));
    } else {
      delay = 250;
      next = () =>
        setState((s) => ({
          index: (s.index + 1) % phrases.length,
          text: "",
          deleting: false,
        }));
    }

    const timer = setTimeout(next, delay);
    return () => clearTimeout(timer);
  }, [state, enabled, phrases]);

  return state.text;
}

export function CompactMenuSheet({
  role,
  permissions,
  actor,
  onNavigate,
  onDragYChange,
  onDragEnd,
}: {
  role: string;
  permissions?: readonly string[] | null;
  actor?: { fullName: string | null; email: string | null; avatarUrl: string | null; role: string };
  onNavigate?: () => void;
  onDragYChange?: (value: number) => void;
  onDragEnd?: (delta: number) => void;
}) {
  // Drag ke bawah hanya berlaku saat scroll konten sudah mentok di atas.
  // Transform diterapkan shell ke POPUP sheet, bukan ke konten di dalamnya.
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const t = useTranslations("nav.menu");
  const tn = useTranslations("nav");
  const router = useRouter();
  const { theme: appTheme, setTheme } = useTheme();
  const [desktop, setDesktop] = useState(false);
  const typedPrompt = useTypewriter(QUICK_PROMPTS, !desktop);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  const { tenants, activeOrgId } = useTenant();
  const { branch } = useBranch();
  const tenant =
    tenants.find((item) => item.id === activeOrgId) ??
    (tenants.length === 1 ? tenants[0] : null);
  const tenantName = tenant?.name ?? "Kaggo";
  const normalizedRole = normalizeAppRole(actor?.role ?? role);
  const roleLabel = normalizedRole ? ROLE_LABEL[normalizedRole] : "Anggota";

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if ((scrollRef.current?.scrollTop ?? 0) <= 0) {
      touchStartY.current = event.touches[0]?.clientY ?? null;
    }
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (touchStartY.current === null) return;
    const delta = (event.touches[0]?.clientY ?? 0) - touchStartY.current;
    if (delta > 0) onDragYChange?.(delta);
    else {
      touchStartY.current = null;
      onDragYChange?.(0);
    }
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartY.current === null) return;
    const delta = (event.changedTouches[0]?.clientY ?? touchStartY.current) - touchStartY.current;
    onDragEnd?.(Math.max(0, delta));
    touchStartY.current = null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F1F1F1] dark:bg-neutral-950">
      <SheetTitle className="sr-only">{t("title")}</SheetTitle>
      <SheetDescription className="sr-only">{t("description")}</SheetDescription>

      {/* Identitas tenant/cabang + command key hanya untuk sheet mobile. */}
      {desktop ? null : (
      <div className="shrink-0 px-5 pt-3">
        <div className="rounded-2xl bg-white/70 p-3 shadow-sm dark:bg-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <TenantLogo
              logoUrl={tenant?.logoUrl ?? null}
              name={tenantName}
              title={tenantName}
              className="size-9 rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {tenantName}
              </p>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                {branch ? `Cabang ${branch.label}` : "Semua cabang"}
              </p>
            </div>
          </div>
          <CommandSearchTrigger
            aria-label={tn("search.placeholder")}
            placeholder={typedPrompt}
            className="mt-3 flex h-9 w-full items-center justify-start rounded-xl border-0 bg-white px-3 text-xs text-neutral-500 shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10 [&>kbd]:hidden"
          />
        </div>
      </div>
      )}

      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-none px-5 pt-2"
      >
        <MenuSection icon={LayoutGrid} label={t("operational")} defaultOpen>
          <MenuOperational role={role} permissions={permissions} onNavigate={onNavigate} />
        </MenuSection>

        <MenuSection icon={BarChart3} label={t("analytic")}>
          <MenuAnalytic onNavigate={onNavigate} />
        </MenuSection>

        <MenuSection icon={Sun} label={t("preferences")}>
          <MenuPreferences />
        </MenuSection>

        <MenuSection icon={Volume2} label={t("sound")}>
          <MenuSound />
        </MenuSection>

        {/* Printer disimpan per perangkat (localStorage), jadi pengaturan ini
            memang milik frontliner/teknisi yang mencetak, bukan master admin. */}
        <MenuSection icon={Printer} label={t("printer")}>
          <PrinterSettings compact />
        </MenuSection>

        {/* Profil hanya untuk sheet mobile; footer tetap tampil di desktop. */}
        {desktop ? null : (
        <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
        <ProfileDropdown
          accounts={[
            {
              id: "staff",
              name: actor?.fullName ?? "Pengguna",
              email: actor?.email ?? "",
              avatarUrl: actor?.avatarUrl ?? null,
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
          panelWidth="trigger"
          onThemeChange={(next) => setTheme(next)}
          onSignOut={() => {
            void (async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              window.location.assign("/login");
            })();
          }}
          className="block w-full [&>button]:w-full [&>button]:rounded-xl [&>button]:border-black/5 [&>button]:bg-white [&>button]:shadow-sm dark:[&>button]:border-white/10 dark:[&>button]:bg-neutral-900"
        />
        </div>
        )}

        <footer className="pt-4 text-center">
          <AppImage
            src="/Logo/IconLogo.png?v=2"
            alt="Kaggo"
            width={36}
            height={36}
            crisp
            className="mx-auto size-9 object-contain"
          />
          <p className="mt-2 text-[11px] font-medium text-neutral-800 dark:text-neutral-200">
            Kaggo! All rights reserved.
          </p>
          <p className="mt-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
            V0.1.0 / Made by Sat.
          </p>
        </footer>
      </div>
    </div>
  );
}
