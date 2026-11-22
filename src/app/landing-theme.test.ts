import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFileSync(join(process.cwd(), relative), "utf8");

const page = read("src/app/page.tsx");
const css = read("src/app/globals.css");
const hero = read("src/components/originkit/hero-02.tsx");
const bento = read("src/components/landing/bento-section.tsx");
const pricing = read("src/components/pricing-three-tier.tsx");
const why = read("src/components/landing/why-digital-pos.tsx");
const layout = read("src/app/layout.tsx");
const sync = read("src/components/layout/theme-color-sync.tsx");

describe("landing page tidak mengikuti mode dark/light aplikasi", () => {
  it("pembungkus landing memakai scope terang", () => {
    expect(page).toMatch(/bg-background text-foreground landing-light/);
  });

  it("scope terang memakai token terang yang sama dengan :root", () => {
    // `.landing-light` masuk blok `:root, .lacak-light`, jadi deklarasi
    // langsung di elemen mengalahkan nilai yang diwariskan dari html.dark.
    expect(css).toMatch(/:root,\s*\.lacak-light,\s*\.landing-light \{/);
  });

  it("komponen landing tidak punya varian dark:", () => {
    expect(hero).not.toMatch(/dark:/);
    expect(bento).not.toMatch(/dark:/);
    expect(pricing).not.toMatch(/dark:/);
  });
});

describe("section mengapa UMKM butuh kasir digital", () => {
  it("berada setelah Bento dan sebelum fitur", () => {
    const bento = page.indexOf("<BentoSection />");
    const whyAt = page.indexOf("<WhyDigitalPos />");
    const fitur = page.indexOf('<section id="fitur"');
    expect(bento).toBeGreaterThan(-1);
    expect(whyAt).toBeGreaterThan(bento);
    expect(whyAt).toBeLessThan(fitur);
  });

  it("berisi empat kartu masalah dengan judul Kaggo", () => {
    expect(why).toContain("Mengapa UMKM butuh aplikasi kasir digital?");
    for (const title of [
      "Servis & antrean tidak tercatat",
      "Laporan kas menyita waktu",
      "Stok sparepart tidak terkontrol",
      "Susah pantau cabang & teknisi",
    ]) {
      expect(why, title).toContain(title);
    }
  });

  it("memakai grid responsif dan Card, tanpa varian dark", () => {
    expect(why).toContain("sm:grid-cols-2 lg:grid-cols-4");
    expect(why).toContain("<Card");
    expect(why).not.toContain("dark:");
  });
});

describe("status bar / toolbar browser mengikuti warna halaman", () => {
  it("landing memaksa theme-color putih", () => {
    expect(page).toMatch(/export const viewport: Viewport = \{\s*themeColor: "#ffffff"/);
  });

  it("layout memakai theme-color light/dark untuk preferensi sistem", () => {
    expect(layout).toContain('media: "(prefers-color-scheme: light)"');
    expect(layout).toContain('media: "(prefers-color-scheme: dark)"');
    expect(layout).toContain("<ThemeColorSync />");
  });

  it("sinkronisasi mengikuti rute dan toggle tema", () => {
    expect(sync).toContain('pathname === "/"');
    expect(sync).toContain('resolvedTheme !== "dark"');
    expect(sync).toContain('meta[name="theme-color"]');
    expect(sync).toContain("meta.removeAttribute(\"media\")");
  });
});
