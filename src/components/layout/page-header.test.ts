import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

/**
 * Komentar dibuang sebelum diperiksa: file ini sengaja menyebut `useShellChrome`
 * di komentar penjelas, jadi tanpa filter test akan gagal karena dokumentasinya,
 * bukan karena kodenya.
 */
const readCode = (relative: string) =>
  read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !(/(?<!:)\/\//.test(line) || line.trimStart().startsWith("//")))
    .join("\n");

const pageHeader = readCode("src/components/layout/page-header.tsx");
const shellChrome = readCode("src/components/layout/shell-chrome.tsx");
const pageBreadcrumb = readCode("src/components/layout/page-breadcrumb.tsx");
const filterGroup = readCode("src/components/layout/filter-group.tsx");
const pageHeaderContainer = readCode("src/components/layout/page-header-container.tsx");

/**
 * `PageHeader` dipanggil dari route server (`/app/inventori`, `/app/servis/baru`,
 * dan lainnya) DAN dari client component. Hook `useShellChrome` hanya boleh
 * dipanggil di client, jadi `PageHeader` tidak boleh memanggilnya langsung --
 * tidak dengan Pathway `PageHeader` sebagai client component, karena `title`
 * dan `description`-nya datang dari server sebagai `ReactNode`.
 */
describe("PageHeader tetap server component", () => {
  it("tidak punya 'use client'", () => {
    expect(pageHeader).not.toMatch(/^\s*["']use client["']/m);
  });

  it("tidak memanggil hook client secara langsung", () => {
    // Ini penyebab bug: "Attempted to call useShellChrome() from the server".
    expect(pageHeader).not.toMatch(/useShellChrome/);
  });

  it("memakai komponen ShellChrome sebagai gantinya", () => {
    expect(pageHeader).toMatch(/<ShellChrome\s*\/>/);
    expect(pageHeader).toMatch(/import \{ ShellChrome \} from "\.\/shell-chrome"/);
  });

  it("nama halaman dirender sebagai breadcrumb, bukan h1 polos", () => {
    expect(pageHeader).toMatch(/<PageBreadcrumb\s/);
    expect(pageHeader).not.toMatch(/<h1/);
  });

  it("tidak merender teks deskripsi di bawah breadcrumb", () => {
    expect(pageHeader).not.toMatch(/text-muted-foreground/);
  });

  it("containerClassName hanya membatasi baris filter, bukan baris breadcrumb/chrome", () => {
    const breadcrumbRow = pageHeader.slice(
      pageHeader.indexOf("flex min-h-16"),
      pageHeader.indexOf("<ShellChrome"),
    );
    expect(breadcrumbRow).not.toContain("containerClassName");
  });
});

describe("gap header mengikuti shell", () => {
  it("PageHeader memakai PageHeaderContainer untuk kedua baris", () => {
    expect(pageHeader.match(/<PageHeaderContainer/g) ?? []).toHaveLength(2);
  });

  it("compact mengikuti konten, master admin memakai penuh", () => {
    expect(pageHeaderContainer).toMatch(/useShellChrome\(\)/);
    expect(pageHeaderContainer).toMatch(/mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8/);
    expect(pageHeaderContainer).toMatch(/w-full px-3 sm:px-4 lg:px-5/);
  });
});

describe("PageBreadcrumb", () => {
  it("adalah client component yang membaca pathname", () => {
    expect(pageBreadcrumb).toMatch(/^\s*["']use client["']/m);
    expect(pageBreadcrumb).toMatch(/usePathname\(\)/);
  });

  it("memakai primitive breadcrumb coss dan mengecualikan shell compact", () => {
    for (const name of [
      "Breadcrumb",
      "BreadcrumbList",
      "BreadcrumbItem",
      "BreadcrumbLink",
      "BreadcrumbSeparator",
      "BreadcrumbPage",
    ]) {
      expect(pageBreadcrumb).toContain(name);
    }
    expect(pageBreadcrumb).toMatch(/useShellChrome\(\)/);
  });

  it("beranda bernama Dashboard dan menyisipkan grup menu dari manifest", () => {
    expect(pageBreadcrumb).toContain('"Dashboard"');
    expect(pageBreadcrumb).not.toContain('"Beranda"');
    expect(pageBreadcrumb).toContain("NAV_ENTRIES");
    expect(pageBreadcrumb).toContain("GROUP_LABEL");
  });

  it("crumb terakhir dipotong dengan ellipsis tanpa kelas ukuran font", () => {
    expect(pageBreadcrumb).toMatch(/<BreadcrumbPage className="truncate">/);
    expect(pageBreadcrumb).not.toMatch(/<BreadcrumbPage[^>]*text-xl/);
    expect(pageBreadcrumb).not.toMatch(/<BreadcrumbPage[^>]*font-heading/);
  });

  it("rute bertingkat menyertakan entri induk (Inventori) dan label Stock Opname", () => {
    expect(pageBreadcrumb).toContain('opname: "Stock Opname"');
    expect(pageBreadcrumb).toMatch(/label: entry\.label, href: entry\.href, hideOnMobile: true/);
  });

  it("mobile hanya menampilkan nama halaman saat ini", () => {
    expect(pageBreadcrumb).toContain('className="hidden sm:inline-flex"');
    expect(pageBreadcrumb).toContain('className="hidden sm:block"');
    expect(pageBreadcrumb).not.toContain('crumb.hideOnMobile && "hidden sm:inline-flex"');
  });

  it("dashboard bisa memaksa filter tampil tanpa tombol", () => {
    expect(pageHeader).toContain("filtersAlwaysVisible");
    expect(filterGroup).toContain("alwaysVisible");
  });
});

describe("toolbar aksi mobile tidak keluar viewport", () => {
  it("membungkus tombol aksi di mobile dan tetap satu baris di desktop", () => {
    const actionsRow = pageHeader.match(/<div className="([^"]*)">\{actions\}<\/div>/)?.[1] ?? "";
    expect(actionsRow).toContain("flex-wrap");
    expect(actionsRow).toContain("w-full");
    expect(actionsRow).toContain("min-w-0");
    expect(actionsRow).toContain("sm:flex-nowrap");
    expect(actionsRow).toContain("sm:shrink-0");
    // `shrink-0` tanpa prefix sm: membuat baris ini tidak bisa menyusut di
    // mobile, sehingga tombolnya terpotong oleh overflow-x-hidden shell.
    expect(actionsRow).not.toMatch(/(^|\s)shrink-0(\s|$)/);
  });
});

describe("ShellChrome memegang hook client", () => {
  it("adalah client component", () => {
    expect(shellChrome).toMatch(/^\s*["']use client["']/m);
  });

  it("memanggil useShellChrome dan merender search + tema", () => {
    expect(shellChrome).toMatch(/useContext\(ShellChromeContext\)/);
    expect(shellChrome).toMatch(/<ThemeToggle\s*\/>/);
    expect(shellChrome).toMatch(/<CommandSearchTrigger\s*\/>/);
  });

  it("lewat saat shell compact sudah menyediakannya", () => {
    // Shell compact merender search + tema sendiri; kalau PageHeader juga
    // merendernya, teknisi dan frontliner melihat dua header bertumpuk.
    expect(shellChrome).toMatch(/if \(shellHasChrome\) return null/);
  });
});
