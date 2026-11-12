import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const pageHeader = read("src/components/layout/page-header.tsx");
const compactShell = read("src/components/layout/compact-shell.tsx");
const compactBottomBar = read("src/components/layout/compact-bottom-bar.tsx");
const compactDockNav = read("src/components/layout/compact-dock-nav.tsx");
const legacyShell = read("src/components/layout/app-shell.tsx");

/**
 * Shell compact merender header sendiri (baris h-14 dengan kotak pencarian),
 * sementara `PageHeader` juga merender `<header>` yang memuat
 * `ThemeToggle` + `CommandSearchTrigger`. Dulu keduanya muncul bertumpuk --
 * header ganda.
 *
 * `AppShell` legacy tidak merender header, jadi `PageHeader` selalu jadi satu-
 * satunya header di sana. Di compact, `ShellChromeProvider` mematikan chrome
 * `PageHeader` supaya search dan tombol layar penuh hanya dirender sekali.
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

  it("CompactShell menyediakan pencarian dan tombol layar penuh", () => {
    // Search dan chrome PageHeader dilewati di shell compact, jadi search
    // dan tombol layar penuh harus ada di header CompactShell. ThemeToggle
    // sengaja tidak dipakai lagi di compact; legacy tetap memakainya.
    expect(compactShell).toMatch(/CommandSearchTrigger/);
    expect(compactShell).toMatch(/FullscreenToggle/);
    expect(compactShell).not.toMatch(/ThemeToggle/);
  });

  it("bar identitas jadi top bar mobile, dock tetap di bawah", () => {
    // Header hanya dirender di `lg`; di bawah itu bar identitas (tenant,
    // search, profil) menempel di atas layar, sedangkan tab halaman di bawah.
    expect(compactShell).toMatch(/<header[^>]*hidden[^>]*lg:block/);
    expect(compactBottomBar).toMatch(/fixed inset-x-0 top-0/);
    expect(compactBottomBar).toMatch(/CommandSearchTrigger/);
    expect(compactDockNav).toMatch(/fixed inset-x-0 bottom-0/);
    expect(compactDockNav).not.toMatch(/CommandSearchTrigger/);
  });

  it("pil profil tetap di kanan saat tombol cari disembunyikan di lg", () => {
    // `lg:hidden` menghapus tombol cari dari grid, jadi tanpa `col-start-3`
    // pil profil auto-place ke kolom tengah: profil dan popover-nya muncul di
    // tengah layar.
    expect(compactBottomBar).toMatch(/col-start-3/);
  });

  it("bottom nav berisi Home, Servis, item role-aware, dan Menu", () => {
    // Menu lengkap tetap di sheet; bottom nav cuma tujuan halaman utama.
    expect(compactDockNav).toMatch(/href: "\/app", label: "Home"/);
    expect(compactDockNav).toMatch(/\/app\/servis/);
    expect(compactDockNav).toMatch(/\/app\/penjualan/);
    expect(compactDockNav).toMatch(/\/app\/sparepart/);
    expect(compactDockNav).toMatch(/TECHNICIAN/);
    expect(compactDockNav).toMatch(/t\("menu\.title"\)/);
    // Overlay mengambang di atas isi halaman.
    expect(compactDockNav).toMatch(/z-40/);
    expect(compactDockNav).toMatch(/pb-\[max/);
  });

  it("chrome compact tidak auto-hide lagi", () => {
    // Search ada di bar yang dulu memudar setelah 5 detik; kalau auto-hide
    // dikembalikan, fitur utamanya ikut hilang dari layar.
    expect(compactShell).not.toMatch(/useIdleVisibility/);
    expect(compactShell).toMatch(/menuOpen=\{open\}/);
  });

  it("tombol layar penuh memakai Fullscreen API dan sinkron dengan Esc", () => {
    const fullscreenToggle = read("src/components/layout/fullscreen-toggle.tsx");
    expect(fullscreenToggle).toMatch(/requestFullscreen/);
    expect(fullscreenToggle).toMatch(/exitFullscreen/);
    expect(fullscreenToggle).toMatch(/fullscreenchange/);
  });

  it("header dan bottom bar compact memakai lebar penuh", () => {
    expect(compactShell).not.toMatch(/max-w-\[1264px\]/);
    expect(compactBottomBar).not.toMatch(/max-w-\[1264px\]/);
  });

  it("bar identitas CompactShell menampilkan nama tenant dan cabang", () => {
    // Rail 70px tidak muat nama, jadi identitas tenant pindah ke pil
    // mengambang di bawah. Tanpa ini, teknisi dan frontliner tidak tahu
    // sedang bekerja untuk tenant dan cabang mana.
    expect(compactShell).toMatch(/CompactBottomBar/);
    expect(compactBottomBar).toMatch(/useTenant/);
    expect(compactBottomBar).toMatch(/useBranch/);
    expect(compactBottomBar).toMatch(/branchLabel/);
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
