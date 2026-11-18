import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/originkit/hero-02.tsx"),
  "utf8",
);

describe("navbar landing", () => {
  it("tidak memakai morph maupun sticky", () => {
    expect(source).not.toMatch(/className="relative sticky top-4 z-40 w-full"/);
    expect(source).not.toContain("--nav-morph");
    expect(source).not.toContain("badgeRef");
    expect(source).not.toContain("morphStartRef");
    expect(source).not.toContain("setMorph");
  });

  it("lebar navbar statis", () => {
    expect(source).toMatch(/mx-auto flex h-\[70px\] w-full max-w-\[995px\]/);
    expect(source).toMatch(/border-\[#dee5ed\] bg-white p-\[12px\] lg:max-w-\[800px\]/);
  });

  it("memiliki menu Home yang menuju atas halaman", () => {
    expect(source).toContain('{ label: "Home", href: "#top" }');
    expect(source).toMatch(/id="top"/);
  });

  it("navbar kedua muncul saat scroll atas ≥8px setelah navbar utama hilang", () => {
    expect(source).toContain("navOffscreenRef");
    expect(source).toContain("upAccumRef");
    expect(source).toContain("lastYRef");
    expect(source).toMatch(/upAccumRef\.current >= 8/);
    expect(source).toMatch(/const ACTIVATE_Y = 120/);
    expect(source).toMatch(/lastYRef\.current > ACTIVATE_Y/);
    expect(source).toMatch(/const RESET_Y = 80/);
    expect(source).toMatch(/y < RESET_Y/);
    expect(source).toMatch(/delta < -0\.5\) upAccumRef\.current \+= -delta/);
    expect(source).toMatch(/delta > 0\.5\) upAccumRef\.current = 0/);
    expect(source).toMatch(/fixed inset-x-0 top-0 z-50/);
    expect(source).toMatch(/<Navbar isLoggedIn=\{isLoggedIn\} user=\{user\} dashboardHref=\{dashboardHref\} \/>/);
    expect(source).toContain("inert={!miniNavVisible}");
  });
});
