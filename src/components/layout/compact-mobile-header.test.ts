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
    expect(bottomBar).toMatch(/absolute inset-x-0 top-0 z-0 h-16 backdrop-blur-md/);
    expect(bottomBar).toMatch(/mask-image:linear-gradient\(to_bottom/);
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

  it("menu sheet langsung penuh tanpa drag untuk membuka", () => {
    expect(compactShell).toMatch(/height: "100dvh"/);
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
