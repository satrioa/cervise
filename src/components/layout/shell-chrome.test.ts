import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const pageHeader = read("src/components/layout/page-header.tsx");
const compactShell = read("src/components/layout/compact-shell.tsx");
const legacyShell = read("src/components/layout/app-shell.tsx");

/**
 * Shell compact merender header sendiri (baris h-14 dengan kotak pencarian),
 * sementara `PageHeader` juga merender `<header>` yang memuat
 * `ThemeToggle` + `CommandSearchTrigger`. Di CompactShell keduanya muncul
 * bertumpuk -- header ganda.
 *
 * `AppShell` legacy tidak merender header, jadi `PageHeader` selalu jadi satu-
 * satunya header di sana. Karena itu duplikat ini hanya terlihat di shell
 * compact.
 */
describe("shell chrome", () => {
  it("AppShell legacy tidak merender header sendiri", () => {
    // Kalau legacy ikut merender header, PageHeader sudah tidak akan pernah
    // menjadi satu-satunya header sejak dulu.
    expect(legacyShell).not.toMatch(/<header/);
  });

  it("CompactShell merender satu header, tidak dua", () => {
    expect(compactShell.match(/<header/g) ?? []).toHaveLength(1);
  });

  it("CompactShell menyediakan pencarian dan tema untuk menggantikan PageHeader", () => {
    // Search dan ThemeToggle dilewati di shell compact, jadi keduanya harus
    // pindah ke header CompactShell. Kalau tidak, teknisi dan frontliner
    // kehilangan kotak pencarian dan tombol tema.
    expect(compactShell).toMatch(/CommandSearchTrigger/);
    expect(compactShell).toMatch(/ThemeToggle/);
  });

  it("header CompactShell menampilkan nama tenant dan cabang", () => {
    // Rail 70px tidak muat nama, jadi identitas tenant pindah ke header.
    // Tanpa ini, teknisi dan frontliner tidak tahu sedang bekerja untuk
    // tenant dan cabang mana.
    expect(compactShell).toMatch(/useTenant/);
    expect(compactShell).toMatch(/useBranch/);
  });

  it("sidebar compact memakai ikon fill, sidebar legacy tetap garis", () => {
    const compactSidebar = read("src/components/layout/compact-sidebar.tsx");
    expect(compactSidebar).toMatch(/fill="currentColor"/);
    // Sidebar legacy ikut membaca manifest, jadi ikon di sana tidak boleh ikut
    // terisi -- hanya rail compact yang diminta berubah.
    expect(legacyShell).not.toMatch(/fill="currentColor"/);
  });

  it("CompactShell membungkus anak-anaknya dengan ShellChromeProvider", () => {
    expect(compactShell).toMatch(/ShellChromeProvider/);
  });

  it("PageHeader melompat search dan tema kalau shell sudah menyediakan", () => {
    // Penanda reads dari context, bukan prop: 21 pemanggil PageHeader tidak
    // boleh harus diubah satu per satu.
    expect(pageHeader).toMatch(/useShellChrome|ShellChromeProvider|shellChrome/);
  });
});
