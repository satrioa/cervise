import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const hero = readFileSync(
  join(process.cwd(), "src/components/originkit/hero-02.tsx"),
  "utf8",
);
const carousel = readFileSync(
  join(process.cwd(), "src/components/phone-carousel.tsx"),
  "utf8",
);

describe("showcase iPhone tidak memakai white fade", () => {
  it("mockup tidak punya overlay gradient putih", () => {
    expect(hero).not.toMatch(/bg-gradient-to-b from-\[\#f8fafc\]/);
    expect(hero).not.toContain("Fade putih");
  });

  it("mask bawah carousel mobile tetap dipertahankan", () => {
    expect(carousel).toMatch(
      /max-md:\[mask-image:linear-gradient\(to_bottom,black_70%,transparent_100%\)\]/,
    );
  });
});
