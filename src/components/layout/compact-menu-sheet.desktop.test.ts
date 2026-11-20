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

  it("profil berada di luar area scroll", () => {
    const scrollIndex = source.indexOf("ref={scrollRef}");
    const profileIndex = source.indexOf("<ProfileDropdown");
    expect(profileIndex).toBeGreaterThan(scrollIndex);
  });
});
