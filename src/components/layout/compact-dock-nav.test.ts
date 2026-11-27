import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/layout/compact-dock-nav.tsx"),
  "utf8",
);

describe("dock mobile tema normal", () => {
  it("wrap transparan dengan fade hitam di belakangnya", () => {
    expect(source).toMatch(/bg-gradient-to-t from-black\/40 via-black\/20 to-transparent/);
    expect(source).not.toContain("bg-white/95");
    expect(source).not.toContain("dark:bg-neutral-900/95");
    expect(source).not.toContain("ring-black/5");
    expect(source).not.toContain("dark:ring-white/10");
  });

  it("dock berbentuk pill dengan item aktif berlabel", () => {
    expect(source).toContain("rounded-full bg-muted/80");
    expect(source).toContain("ring-border/60 backdrop-blur");
    expect(source).toContain("{item.label}");
    expect(source).toContain("flex-1 justify-start gap-2 rounded-full bg-card px-4");
    expect(source).toContain("size-11 shrink-0 rounded-full text-muted-foreground");
  });

  it("tombol plus membuka menu", () => {
    expect(source).toContain("onOpenMenu: () => void");
    expect(source).toContain('aria-label="Buka menu"');
    expect(source).toContain("onClick={onOpenMenu}");
    expect(source).toContain("<PlusIcon");
    expect(source).toContain("bg-foreground text-background");
  });

  it("ikon aktif di-fill, ikon non-aktif berbentuk line", () => {
    expect(source).toMatch(/fill=\{active \? "currentColor" : "none"\}/);
  });

  it("aktif memakai foreground, nonaktif muted", () => {
    expect(source).toContain("bg-card px-4 text-foreground");
    expect(source).toContain("size-11 shrink-0 rounded-full text-muted-foreground");
    expect(source).not.toMatch(/opacity-80/);
  });


  it("dark mode memakai kartu gelap pada item aktif", () => {
    expect(source).toContain("dark:bg-neutral-800");
  });

  it("item berdekatan dalam pill dan fade hitam lembut", () => {
    expect(source).toMatch(/items-center gap-1 rounded-full bg-muted\/80/);
    expect(source).toMatch(/from-black\/40 via-black\/20 to-transparent/);
  });

  it("melekat di bawah dengan pill melingkar", () => {
    expect(source).toContain("fixed inset-x-0 bottom-0 z-30");
    expect(source).toContain("lg:hidden");
    expect(source).toContain("rounded-full bg-muted/80");
    expect(source).not.toMatch(/px-3 pb-\[max/);
  });

  it("gap bawah lebih besar dari gap atas", () => {
    expect(source).toContain("pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]");
  });
});
