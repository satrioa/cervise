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
