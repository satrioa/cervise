import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(process.cwd(), "src/components/originkit/hero-02.css"),
  "utf8",
);
const source = readFileSync(
  join(process.cwd(), "src/components/originkit/hero-02.tsx"),
  "utf8",
);

describe("hero pulsing gradient background", () => {
  it("mendefinisikan animasi pulse 14 detik", () => {
    expect(css).toContain("@keyframes hero-pulse-gradient");
    expect(css).toContain("--animate-hero-pulse: hero-pulse-gradient 14s");
  });

  it("hormati prefers-reduced-motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*hero-pulse-gradient/);
  });

  it("lapisan pulse dimulai dari bawah navbar dan dekoratif", () => {
    expect(source).toMatch(/className="[^"]*origin-top[^"]*animate-hero-pulse/);
    expect(source).toContain("radial-gradient(ellipse 90% 75% at 50% 0%");
    expect(source).toMatch(/animate-hero-pulse[\s\S]{0,300}aria-hidden|aria-hidden[\s\S]{0,300}animate-hero-pulse/);
  });

  it("gradien statis bawah tetap ada tapi diredupkan", () => {
    expect(source).toContain("opacity-60");
    expect(source).toContain("linear-gradient(to bottom, rgba(248,250,252,0) 0%");
  });
});
