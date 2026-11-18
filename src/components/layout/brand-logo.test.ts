import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

describe("logo Cervise", () => {
  it("dipakai pada brand mark login, signup, navbar landing, dan footer menu compact", () => {
    for (const file of [
      "src/app/login/page.tsx",
      "src/app/signup/page.tsx",
      "src/components/originkit/hero-02.tsx",
      "src/components/layout/compact-menu-sheet.tsx",
    ]) {
      expect(read(file)).toContain('src="/Logo/IconLogo.png"');
    }
  });

  it("dipakai sebagai ikon aplikasi dan PWA", () => {
    expect(existsSync(join(process.cwd(), "src/app/icon.png"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/app/apple-icon.png"))).toBe(true);
    expect(read("public/manifest.json")).toContain('"/Logo/badgeicon.png"');
  });

  it("favicon.ico berisi logo baru, bukan favicon default Next", () => {
    const ico = readFileSync(join(process.cwd(), "src/app/favicon.ico"));
    // ICO dengan payload PNG diawali header 22 byte lalu tanda tangan PNG.
    expect(ico.slice(22, 26)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it("ikon tab browser berasal dari favicon.png, bukan badgeicon", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toMatch(/icons:\s*\{/);
    expect(layout).not.toContain('icon: "/Logo/badgeicon.png"');
    expect(layout).toContain('apple: "/Logo/badgeicon.png"');
    expect(existsSync(join(process.cwd(), "src/app/favicon.png"))).toBe(true);
    // favicon.ico dan icon.png keduanya dihasilkan dari favicon.png.
    expect(readFileSync(join(process.cwd(), "src/app/icon.png")).length).toBe(
      readFileSync(join(process.cwd(), "src/app/favicon.png")).length,
    );
    expect(read("public/manifest.json")).not.toContain("/favicon.ico");
  });
});
