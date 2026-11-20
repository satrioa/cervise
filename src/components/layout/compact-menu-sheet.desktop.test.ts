import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/layout/compact-menu-sheet.tsx"),
  "utf8",
);

describe("menu sheet identitas tenant/cabang dan profil", () => {
  it("identitas tenant/cabang berada di luar area scroll", () => {
    const scrollIndex = source.indexOf("ref={scrollRef}");
    const tenantIndex = source.indexOf("<TenantLogo");
    expect(tenantIndex).toBeGreaterThan(-1);
    expect(tenantIndex).toBeLessThan(scrollIndex);
  });

  it("identitas tenant/cabang dan profil disembunyikan di desktop", () => {
    const hidden = source.match(/desktop \? null :/g) ?? [];
    expect(hidden.length).toBeGreaterThanOrEqual(2);
    expect(source).toMatch(/min-width: 1024px/);
  });

  it("profil dan branding tetap ikut scroll di bawah daftar menu", () => {
    const profileIndex = source.indexOf("<ProfileDropdown");
    const footerIndex = source.indexOf("<footer");
    expect(profileIndex).toBeGreaterThan(-1);
    expect(footerIndex).toBeGreaterThan(profileIndex);
    expect(source).toMatch(/Profil hanya untuk sheet mobile; footer tetap tampil di desktop/);
  });
});
