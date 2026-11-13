"use client";

import { useEffect, useState, type ReactNode, type UIEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  MainNavLink,
  MainNavTransitionOutlet,
  MainNavTransitionProvider,
} from "@/components/layout/main-nav-transition";
import { LayoutGrid } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CommandPaletteProvider, CommandSearchTrigger } from "@/components/layout/command-palette-provider";
import { FullscreenToggle } from "@/components/layout/fullscreen-toggle";
import { ShellChromeProvider } from "@/components/layout/shell-chrome";
import { CompactMenuSheet } from "@/components/layout/compact-menu-sheet";
import { CompactBottomBar } from "@/components/layout/compact-bottom-bar";
import { CompactDockNav } from "@/components/layout/compact-dock-nav";
import { PageTransition } from "@/components/layout/page-transition";
import { BranchProvider } from "@/lib/branch-context";
import { TenantProvider } from "@/lib/tenant-context";
import { LocaleProvider } from "@/lib/localization-context";
import { normalizeAppRole } from "@/lib/nav/manifest";
import { OpeningBalanceDialog } from "@/components/cash/opening-balance-dialog";
import { checkOpenCashSession, type CashSessionRow } from "@/app/app/actions/cash";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Shell kedua untuk Cervise, dipakai TECHNICIAN dan FRONTLINER.
 *
 * Struktur provider-nya sama persis dengan `AppShell` — hanya isi yang
 * berbeda. Itu disengaja: `TenantProvider` dan `BranchProvider` sudah
 * mengunci org dan cabang untuk role non-MASTER_ADMIN, jadi teknisi
 * tidak bisa mengarahkan data ke tenant atau cabang lain.
 *
 * Tampilannya mengikuti frame Figma: navigasi tersegmentasi di atas,
 * tombol grid untuk drawer menu lengkap, dan dua pil identitas mengambang
 * di bawah. Rail 70px tidak dipakai lagi.
 */

export type CompactShellActor = {
  role: string;
  orgId: string;
  branchId: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

const MENU_MAX_DVH = 95;
const MENU_MIN_DVH = 70;
const MENU_RANGE_PX = 160;

// Desktop: panel kiri mengambang, tinggi tetap - bentuk lama sebelum drawer
// mobile masuk. Mobile: bottom sheet yang tingginya ikut scroll.
const MENU_SHEET_DESKTOP =
  "gap-0 overflow-hidden rounded-[28px] bg-[#F1F1F1] p-0 shadow-[0_30px_80px_-32px_rgba(0,0,0,0.55)] duration-300 ease-[linear(0,0.35,0.85,1.06,1.02,0.995,1)] dark:bg-neutral-950 data-[side=left]:inset-y-4 data-[side=left]:left-4 data-[side=left]:h-[calc(100%-2rem)] data-[side=left]:w-[calc(100%-2rem)] data-[side=left]:border-0 data-[side=left]:sm:max-w-[340px] data-[side=left]:data-starting-style:translate-x-[-110%]! data-[side=left]:data-ending-style:translate-x-[-110%]!";
const MENU_SHEET_MOBILE =
  "gap-0 overflow-hidden rounded-t-[28px] bg-[#F1F1F1] p-0 shadow-[0_-30px_80px_-32px_rgba(0,0,0,0.55)] duration-300 ease-[linear(0,0.35,0.85,1.06,1.02,0.995,1)] dark:bg-neutral-950";

export function CompactShell({ children, actor }: { children: ReactNode; actor: CompactShellActor }) {
  return (
    <LocaleProvider>
      <TenantProvider fixedOrganizationId={actor.orgId}>
        <BranchProvider fixedBranchId={actor.branchId ?? "unassigned"}>
          <CommandPaletteProvider role={actor.role}>
            {/* Header shell Compact sudah membawa search dan tombol layar
                penuh, jadi PageHeader di dalamnya harus melompat keduanya.
                Tanpa provider ini, halaman Servis, Customer, dan Inventori
                menampilkan dua header bertumpuk untuk TECHNICIAN dan
                FRONTLINER. */}
            <ShellChromeProvider value>
              <CompactShellInner actor={actor}>{children}</CompactShellInner>
            </ShellChromeProvider>
          </CommandPaletteProvider>
        </BranchProvider>
      </TenantProvider>
    </LocaleProvider>
  );
}

function CompactShellInner({
  children,
  actor,
}: {
  children: ReactNode;
  actor: CompactShellActor;
}) {
  const [open, setOpen] = useState(false);
  // Drawer menu memakai dua bentuk: bottom sheet di mobile, panel kiri di
  // desktop. Popup sheet baru dirender saat dibuka, jadi nilai `matchMedia`
  // ini sudah final ketika dipakai - tidak ada kedipan saat hidrasi.
  const [desktop, setDesktop] = useState(false);
  // Drawer menu: tinggi mengikuti nilai scroll konten, bukan snap. Paling atas
  // 70dvh, membesar linear sampai 95dvh setelah 160px scroll.
  const [menuHeight, setMenuHeight] = useState(MENU_MIN_DVH);
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const role = normalizeAppRole(actor.role);

  // scrollTop kembali 0 saat drawer dibuka tanpa memicu event scroll.
  function setMenuOpen(next: boolean) {
    setOpen(next);
    if (next) setMenuHeight(MENU_MIN_DVH);
  }

  function handleMenuScroll(event: UIEvent<HTMLDivElement>) {
    const top = event.currentTarget.scrollTop;
    // Scroll ke bawah -> drawer drag-naik mengikuti nilai scroll, batas atas
    // 95dvh; scroll ke atas -> drag-balik turun ke 70dvh.
    setMenuHeight(
      Math.min(MENU_MAX_DVH, MENU_MIN_DVH + (top / MENU_RANGE_PX) * (MENU_MAX_DVH - MENU_MIN_DVH)),
    );
  }

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setDesktop(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setDesktop(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const tabs =
    role === "FRONTLINER"
      ? [
          { href: "/app", label: "Home" },
          { href: "/app/servis", label: t("items.service") },
          { href: "/app/penjualan", label: t("items.sales") },
        ]
      : [
          { href: "/app", label: "Home" },
          { href: "/app/servis", label: t("items.service") },
          { href: "/app/sparepart", label: t("items.sparepart") },
        ];

  // Saldo awal hanya untuk role yang menjalankan shift kas. TECHNICIAN punya
  // To-Do sendiri dan tidak pernah membuka laci.
  const needsCashSession = role === "FRONTLINER";
  const [session, setSession] = useState<CashSessionRow | null>(null);
  const [cashChecked, setCashChecked] = useState(false);

  useEffect(() => {
    if (!needsCashSession) return;
    let cancelled = false;
    checkOpenCashSession().then((result) => {
      if (cancelled || !result.ok) return;
      setSession(result.data.current);
      setCashChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [needsCashSession]);

  return (
    <MainNavTransitionProvider role={actor.role}>
      <div
        data-shell="compact"
        // `group/shell` dipakai halaman yang butuh mengisi sisa tinggi `main`
        // (lihat Penjualan POS). Dinamai supaya tidak bentrok dengan `group`
        // milik kartu/baris di dalam halaman.
        className="group/shell flex h-svh w-full flex-col overflow-hidden bg-canvas text-neutral-900 dark:text-neutral-100"
      >
        <PageTransition />
        <header className="hidden shrink-0 px-4 pt-3 sm:px-6 sm:pt-4 lg:block lg:px-8">
          <div className="flex w-full items-center gap-2">
            <nav
              aria-label="Navigasi utama"
              className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-full bg-black/[0.055] p-1 scrollbar-none dark:bg-white/10"
            >
              {tabs.map((tab) => {
                const active = isActive(pathname, tab.href);
                return (
                  <MainNavLink
                    key={tab.href}
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:text-sm",
                      active
                        ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                        : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
                    )}
                  >
                    {tab.label}
                  </MainNavLink>
                );
              })}
            </nav>

          <Sheet open={open} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={
                <button
                  type="button"
                  aria-label="Buka menu"
                  title="Buka menu"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-white dark:bg-neutral-900 dark:text-neutral-200 dark:ring-white/10 dark:hover:bg-neutral-800"
                />
              }
            >
              <LayoutGrid fill="currentColor" className="size-[18px]" />
            </SheetTrigger>
            <SheetContent
              side={desktop ? "left" : "bottom"}
              showCloseButton={false}
              // Tinggi mengikuti scroll hanya di mobile (lihat
              // `handleMenuScroll`); di desktop panel kiri tingginya tetap.
              style={desktop ? undefined : { height: `${menuHeight}dvh` }}
              className={desktop ? MENU_SHEET_DESKTOP : MENU_SHEET_MOBILE}
            >
              <CompactMenuSheet
                role={actor.role}
                onNavigate={() => setOpen(false)}
                onScroll={desktop ? undefined : handleMenuScroll}
              />
            </SheetContent>
          </Sheet>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <CommandSearchTrigger
              className="hidden h-10 w-[260px] justify-start rounded-full border-0 bg-white/80 px-4 shadow-sm ring-1 ring-black/5 hover:bg-white dark:bg-neutral-900/80 dark:ring-white/10 dark:hover:bg-neutral-900 lg:flex"
              aria-label="Cari atau buka perintah"
            />
            {/* Kontrol suara ada di section "Sound System" drawer, bukan di
                header: di samping tombol layar penuh ia hanya menambah satu
                tombol yang jarang dipakai. */}
            <FullscreenToggle className="inline-flex size-10 rounded-full border-0 bg-white shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10" />
          </div>
        </div>
      </header>

      <main
        key={pathname}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-[calc(5.5rem_+_env(safe-area-inset-top))] pb-[calc(5rem_+_env(safe-area-inset-bottom))] lg:pt-0 lg:pb-32"
      >
        {/* `h-full` menjaga rantai tinggi halaman (POS mengisi sisa `main`).
            Reveal hanya membungkus isi halaman, bukan chrome shell. */}
        <MainNavTransitionOutlet pageClassName="h-full">
          {children}
        </MainNavTransitionOutlet>
      </main>

      <CompactDockNav
        role={actor.role}
        menuOpen={open}
        onOpenMenu={() => setMenuOpen(true)}
      />

      <CompactBottomBar
        role={actor.role}
        fullName={actor.fullName}
        avatarUrl={actor.avatarUrl}
      />

      {/* Saldo awal wajib. Dialog ini yang menentukan boleh tidaknya
          dashboard dipakai: `cashChecked` menahan render sampai sesi dicek. */}
      {needsCashSession && cashChecked && !session ? (
        <OpeningBalanceDialog
          staffName={actor.fullName ?? undefined}
          onOpened={(next) => {
            setSession(next);
            // Server merender /app sebelum sesi ada. Setelah Buka Shift,
            // muat ulang payload server supaya dashboard langsung melihat
            // toko terbuka tanpa refresh manual.
            router.refresh();
          }}
        />
      ) : null}
      </div>
    </MainNavTransitionProvider>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}
