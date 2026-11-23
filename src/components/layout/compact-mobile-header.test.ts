import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFileSync(join(process.cwd(), relative), "utf8");

const settingsLayout = read("src/app/app/pengaturan/layout.tsx");
const bottomBar = read("src/components/layout/compact-bottom-bar.tsx");
const pageHeader = read("src/components/layout/page-header.tsx");
const menuSheet = read("src/components/layout/compact-menu-sheet.tsx");
const compactShell = read("src/components/layout/compact-shell.tsx");
const compactDock = read("src/components/layout/compact-dock-nav.tsx");
const posClient = read("src/app/app/penjualan/penjualan-pos-client.tsx");

describe("header mobile compact", () => {
  it("pengaturan compact tidak punya sub-sidebar", () => {
    expect(settingsLayout).toMatch(/return <div className="flex-1 min-h-0 overflow-y-auto">\{children\}<\/div>;/);
    const compactBranch = settingsLayout.slice(settingsLayout.indexOf("if (!isCompact)"));
    expect(compactBranch).not.toContain("<SettingsNav");
    expect(compactBranch).not.toContain("<SettingsMobileNav");
    expect(compactBranch).not.toContain("<aside");
  });

  it("bar mobile berisi logo, judul tengah, dan tombol grid", () => {
    expect(bottomBar).toMatch(/lg:hidden/);
    expect(bottomBar).toMatch(/<TenantLogo/);
    expect(bottomBar).toMatch(/flex-1 truncate text-center/);
    expect(bottomBar).toMatch(/<LayoutGrid fill="currentColor"/);
    expect(bottomBar).toMatch(/onClick=\{onOpenMenu\}/);
    expect(bottomBar).toMatch(/hidden w-full items-center gap-2 lg:flex/);
  });

  it("progressive blur di belakang navbar mobile tanpa lapisan gelap", () => {
    expect(bottomBar).toMatch(/-top-\[max\(0\.5rem,env\(safe-area-inset-top\)\)\]/);
    expect(bottomBar).toMatch(/h-\[calc\(4rem\+env\(safe-area-inset-top\)\)\] backdrop-blur-md/);
    expect(bottomBar).toMatch(/mask-image:linear-gradient\(to_bottom/);
    expect(bottomBar).toMatch(/-mx-3/);
    expect(bottomBar).toMatch(/sm:-mx-6/);
    expect(bottomBar).toMatch(/relative z-10 flex w-full items-center/);
    expect(bottomBar).not.toMatch(/from-canvas via-canvas\/60/);
    expect(bottomBar).toMatch(/lg:hidden/);
  });

  it("judul halaman PageHeader disembunyikan dan toolbar ikut scroll di mobile compact", () => {
    expect(pageHeader).toMatch(/group-data-\[shell=compact\]\/shell:hidden/);
    expect(pageHeader).toMatch(/lg:group-data-\[shell=compact\]\/shell:block/);
    expect(pageHeader).toMatch(/group-data-\[shell=compact\]\/shell:relative/);
    expect(pageHeader).toMatch(/lg:group-data-\[shell=compact\]\/shell:sticky/);
  });

  it("header compact menyatu dengan warna canvas, bukan putih", () => {
    expect(pageHeader).toMatch(/group-data-\[shell=compact\]\/shell:bg-canvas/);
    expect(pageHeader).toMatch(/group-data-\[shell=compact\]\/shell:dark:bg-canvas/);
    expect(pageHeader).toMatch(/group-data-\[shell=compact\]\/shell:border-b-0/);
    expect(pageHeader).toMatch(/lg:group-data-\[shell=compact\]\/shell:border-border\/30/);
  });

  it("menu sheet langsung penuh tanpa drag untuk membuka", () => {
    expect(compactShell).toMatch(/height: "95dvh"/);
    expect(compactShell).not.toMatch(/handleMenuScroll/);
    expect(compactShell).not.toMatch(/menuHeight/);
    expect(menuSheet).not.toMatch(/onScroll/);
  });

  it("drag ke bawah saat konten mentok atas menutup sheet", () => {
    expect(menuSheet).toMatch(/scrollTop \?\? 0\) <= 0/);
    expect(menuSheet).toMatch(/onTouchStart/);
    expect(menuSheet).toMatch(/onTouchMove/);
    expect(menuSheet).toMatch(/onTouchEnd/);
    expect(menuSheet).toMatch(/onDragYChange\?\.\(delta\)/);
    expect(menuSheet).toMatch(/onDragEnd\?\./);
    expect(compactShell).toMatch(/delta > 100/);
  });

  it("dock hilang saat scroll turun dan muncul saat scroll naik", () => {
    expect(compactShell).toMatch(/onScroll=\{handleContentScroll\}/);
    expect(compactShell).toMatch(/scrollDelta\.current > 8 && top > 120/);
    expect(compactShell).toMatch(/setDockHidden\(true\)/);
    expect(compactShell).toMatch(/setDockHidden\(false\)/);
    expect(compactShell).toMatch(/hidden=\{dockHidden\}/);
    expect(compactDock).toMatch(/hidden \? "translate-y-full opacity-0"/);
  });

  it("typewriter aksi cepat ada di searchbar menu, bukan di popover", () => {
    expect(menuSheet).toMatch(/"Tambah data servis"/);
    expect(menuSheet).toMatch(/"Tambah stok produk"/);
    expect(menuSheet).toMatch(/"SRV-2029-\*\*\*"/);
    expect(menuSheet).toMatch(/function useTypewriter/);
    expect(menuSheet).toMatch(/placeholder=\{typedPrompt\}/);
    // Habis siklus tidak ada placeholder fallback.
    expect(menuSheet).not.toMatch(/typedPrompt \|\|/);
  });

  it("dock tersembunyi saat tahap pembayaran POS aktif", () => {
    expect(compactDock).toMatch(/group-has-\[\[data-hide-dock\]\]\/shell:hidden/);
    expect(posClient).toMatch(/data-hide-dock/);
    const paymentBranch = posClient.slice(posClient.indexOf("stage === \"cart\" ?"));
    expect(paymentBranch).toMatch(/data-hide-dock/);
  });

  it("sheet slide ke bawah dengan opacity penuh dan backdrop transparan", () => {
    expect(compactShell).toMatch(/--drag-y/);
    expect(compactShell).toMatch(/translate-y-\[var\(--drag-y\)\]/);
    expect(compactShell).toMatch(/overlayClassName/);
    expect(compactShell).toMatch(/bg-transparent!/);
    expect(compactShell).toMatch(/slideDownOnClose=\{!desktop\}/);
    const sheet = read("src/components/ui/sheet.tsx");
    expect(sheet).toMatch(/slideDownOnClose/);
    expect(sheet).toMatch(/data-ending-style:translate-y-full!/);
    expect(sheet).toMatch(/data-ending-style:opacity-100!/);
  });

  it("menu sheet memuat tenant, cabang, cari, dan profil di bawah", () => {
    expect(menuSheet).toMatch(/tenantName/);
    expect(menuSheet).toMatch(/Cabang \$\{branch\.label\}/);
    expect(menuSheet).toMatch(/<CommandSearchTrigger/);
    expect(menuSheet).toMatch(/<MenuOperational/);
    const printerIndex = menuSheet.indexOf("<MenuSection icon={Printer}");
    const profileIndex = menuSheet.indexOf("<ProfileDropdown");
    const footerIndex = menuSheet.indexOf("<footer");
    expect(profileIndex).toBeGreaterThan(printerIndex);
    expect(profileIndex).toBeLessThan(footerIndex);
    // Footer berada di dalam area scroll yang sama dengan menu.
    const scrollOpen = menuSheet.indexOf("overflow-y-auto overscroll-contain");
    expect(footerIndex).toBeGreaterThan(scrollOpen);
  });
});
