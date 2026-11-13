"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import Link, { type LinkProps } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { normalizeAppRole } from "@/lib/nav/manifest";
import { AsciiPage } from "@/components/layout/ascii-page";

type Direction = "forward" | "back";

type MainNavContextValue = {
  /** Href tujuan utama terurut untuk role aktif. */
  hrefs: string[];
  /** Indeks href utama yang cocok dengan pathname, atau -1. */
  activeIndex: number;
  isMain: (href: string) => boolean;
  /** Navigasi dengan animasi slide jika target adalah nav utama. */
  navigate: (href: string) => void;
  /** Arah slide untuk render konten saat ini (sekali pakai per navigasi). */
  direction: Direction | null;
};

const MainNavContext = createContext<MainNavContextValue | null>(null);

export function mainNavHrefsForRole(role: string): string[] {
  const third =
    normalizeAppRole(role) === "TECHNICIAN" ? "/app/sparepart" : "/app/penjualan";
  return ["/app", "/app/servis", third];
}

export function mainNavIndex(pathname: string, hrefs: string[]): number {
  const idx = hrefs.indexOf(pathname);
  if (idx !== -1) return idx;
  return hrefs.findIndex((href) => href !== "/app" && pathname.startsWith(`${href}/`));
}

export function MainNavTransitionProvider({
  role,
  children,
}: {
  role: string;
  children: ReactNode;
}) {
  const hrefs = useMemo(() => mainNavHrefsForRole(role), [role]);
  const pathname = usePathname();
  const router = useRouter();
  const activeIndex = mainNavIndex(pathname, hrefs);
  const prevIndexRef = useRef<number>(activeIndex);
  // Cegah animasi saat pertama mount/SSR-hydrate.
  const mountedRef = useRef(false);
  // Tandai navigasi yang sudah kita animasikan (klik) agar popstate/back-forward
  // tidak menganimasikan dua kali.
  const programmaticRef = useRef(false);
  const [direction, setDirection] = useState<Direction | null>(null);

  const isMain = useCallback((href: string) => hrefs.includes(href), [hrefs]);

  const navigate = useCallback(
    (href: string) => {
      if (!isMain(href) || href === pathname) {
        if (href !== pathname) router.push(href);
        return;
      }
      const to = hrefs.indexOf(href);
      const from = prevIndexRef.current;
      const dir: Direction = to > from ? "forward" : "back";
      programmaticRef.current = true;
      prevIndexRef.current = to;
      setDirection(dir);
      router.push(href);
    },
    [hrefs, isMain, pathname, router],
  );

  // Back/forward browser antar nav utama: pathname berubah tanpa navigate().
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevIndexRef.current = activeIndex;
      return;
    }
    if (programmaticRef.current) {
      programmaticRef.current = false;
      prevIndexRef.current = activeIndex;
      return;
    }
    const from = prevIndexRef.current;
    const to = activeIndex;
    prevIndexRef.current = activeIndex;
    if (from === -1 || to === -1 || from === to) return;
    setDirection(to > from ? "forward" : "back");
  }, [activeIndex]);

  // Arah dipakai sekali oleh outlet (yang di-key pathname). Bersihkan setelah
  // pathname baru ter-commit agar tidak bocor ke render berikutnya.
  useEffect(() => {
    if (direction !== null) setDirection(null);
  }, [pathname]);

  const value = useMemo(
    () => ({ hrefs, activeIndex, isMain, navigate, direction }),
    [hrefs, activeIndex, isMain, navigate, direction],
  );

  return <MainNavContext.Provider value={value}>{children}</MainNavContext.Provider>;
}

export function useMainNavTransition() {
  const ctx = useContext(MainNavContext);
  if (!ctx) throw new Error("useMainNavTransition must be used within MainNavTransitionProvider");
  return ctx;
}

/**
 * Link untuk navigasi utama: mencegah navigasi default dan memakai transisi
 * slide bila target adalah salah satu tab utama. Di luar itu berperilaku
 * seperti Link biasa.
 */
export function MainNavLink(
  props: Omit<LinkProps, "href"> & {
    href: string;
    className?: string;
    children: ReactNode;
    "aria-label"?: string;
    "aria-current"?: "page" | undefined;
    title?: string;
  },
) {
  const { href, onClick, ...rest } = props;
  const nav = useContext(MainNavContext);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (!nav?.isMain(href)) return;
    // Biarkan perilaku browser untuk tab baru/modifier.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    nav.navigate(href);
  };

  return <Link href={href} onClick={handleClick} {...rest} />;
}

/**
 * Konten yang dianimasikan slide saat navigasi antar tab utama. `key` pathname
 * memaksa remount sehingga animasi masuk berjalan konsisten, termasuk
 * back/forward browser. Saat slide aktif, efek reveal blueprint AsciiPage
 * dilewati agar tidak menimbulkan blip/ganda animasi.
 */
export function MainNavTransitionOutlet({
  children,
  pageClassName,
}: {
  children: ReactNode;
  pageClassName?: string;
}) {
  const pathname = usePathname();
  const nav = useContext(MainNavContext);
  const reduce = useReducedMotion();
  // Tangkap arah per mount (keyed pathname). Untuk popstate, arah baru
  // diketahui setelah commit (effect), jadi ambil dari context bila muncul.
  const [dir, setDir] = useState<Direction | null>(nav?.direction ?? null);
  useEffect(() => {
    if (!dir && nav?.direction) setDir(nav.direction);
  }, [dir, nav?.direction]);
  const offset = dir === "forward" ? "22%" : dir === "back" ? "-22%" : 0;
  const page = (
    <AsciiPage className={pageClassName} reveal={!dir || !!reduce}>
      {children}
    </AsciiPage>
  );

  if (!dir || reduce) {
    return (
      <div key={pathname} data-main-nav-content className="h-full min-h-0 bg-canvas">
        {page}
      </div>
    );
  }

  return (
    <motion.div
      key={pathname}
      data-main-nav-content
      className="h-full min-h-0 bg-canvas"
      initial={{ x: offset }}
      animate={{ x: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {page}
    </motion.div>
  );
}
