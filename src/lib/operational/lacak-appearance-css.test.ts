import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LACAK_DENSITIES, LACAK_FONTS, LACAK_PALETTES } from "./lacak-appearance";

const CSS_PATH = join(process.cwd(), "src", "app", "globals.css");
const css = readFileSync(CSS_PATH, "utf8");

/**
 * Nilai appearance berakhir sebagai selector `data-*`. Kalau nama di
 * TypeScript dan di CSS berbeda, tokennya tidak pernah terpakai dan
 * halamannya tetap netral tanpa error apa pun - jadi harus dijaga test.
 */
describe("konsistensi token Lacak dengan globals.css", () => {
  it("mempunyai blok token terang dan gelap untuk elemen mana pun", () => {
    expect(css).toMatch(/^\.lacak-light\s*\{/m);
    expect(css).toMatch(/^\.lacak-dark\s*\{/m);
  });

  it("mempunyai blok dasar .lacak-theme", () => {
    expect(css).toMatch(/^\.lacak-theme\s*\{/m);
    for (const token of ["--lacak-pad-card", "--lacak-gap", "--lacak-text-title", "--lacak-text-body"]) {
      expect(css).toContain(`${token}:`);
    }
  });

  it("hanya menimpa lima token warna per palette", () => {
    for (const palette of LACAK_PALETTES) {
      const blok = css.match(new RegExp(`^\\.lacak-theme\\[data-palette="${palette}"\\][^}]*}`, "m"));
      if (palette === "graphite") {
        expect(blok, "graphite sengaja tidak punya blok").toBeNull();
        continue;
      }
      expect(blok, `palette ${palette} tidak punya blok CSS`).not.toBeNull();
      for (const token of ["--primary", "--primary-foreground", "--accent", "--accent-foreground", "--ring"]) {
        expect(blok![0], `palette ${palette} tidak menimpa ${token}`).toContain(`${token}:`);
      }
    }
  });

  it("mempunyai blok untuk setiap font", () => {
    for (const font of LACAK_FONTS) {
      expect(css, `font ${font} tidak punya blok CSS`).toMatch(
        new RegExp(`^\\.lacak-theme\\[data-font="${font}"\\][^}]*}`, "m"),
      );
    }
  });

  it("mempunyai blok untuk setiap density selain nilai dasar", () => {
    for (const density of LACAK_DENSITIES) {
      if (density === "cozy") continue; // cozy adalah nilai dasar di .lacak-theme
      expect(css, `density ${density} tidak punya blok CSS`).toMatch(
        new RegExp(`^\\.lacak-theme\\[data-density="${density}"\\][^}]*}`, "m"),
      );
    }
  });

  it("memakai nama keluarga font yang benar-benar di-import, bukan varian Variable", () => {
    for (const salah of ["Geist Variable", "Inter Variable", "Geist Mono Variable"]) {
      const blokFont = css.slice(css.indexOf('.lacak-theme[data-font="geist"]'));
      expect(blokFont.slice(0, blokFont.indexOf('/* Palet'))).not.toContain(salah);
    }
  });
});
