import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

describe("logo Cervise", () => {
  it("dipakai pada brand mark login dan navbar landing", () => {
    expect(read("src/app/login/page.tsx")).toContain('src="/Logo/IconLogo.png"');
    expect(read("src/components/originkit/hero-02.tsx")).toContain('src="/Logo/IconLogo.png"');
  });

  it("dipakai sebagai ikon aplikasi dan PWA", () => {
    expect(existsSync(join(process.cwd(), "src/app/icon.png"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/app/apple-icon.png"))).toBe(true);
    expect(read("public/manifest.json")).toContain('"/Logo/badgeicon.png"');
  });
});
