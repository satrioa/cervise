import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/landing/bento-section.tsx"),
  "utf8",
);

describe("kartu Fitur Unggulan", () => {
  it("reveal on scroll dengan stagger antar kartu", () => {
    expect(source).toMatch(/staggerChildren: 0\.12/);
    expect(source).toMatch(/variants=\{gridVariants\}[\s\S]*?initial="hidden"[\s\S]*?whileInView="show"/);
    expect(source).toMatch(/viewport=\{\{ once: true, margin: "-80px" \}\}/);
    // Tiap kartu hanya membawa variants; grid yang mengontrol stagger.
    expect(source).not.toMatch(/variants=\{fadeIn\}[\s\S]*?custom=\{/);
  });

  it("memakai tema gelap", () => {
    expect((source.match(/bg-neutral-950/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(source).not.toContain("bg-white/[0.04]");
    expect(source).not.toContain("bg-background dark:bg-background");
    expect(source).toContain("text-white");
    expect(source).toContain("text-neutral-400");
  });
});
