import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(join(process.cwd(), `src/components/owner/${name}`), "utf8");

const MUTATING_COMPONENTS = [
  "meta-phone-number-form.tsx",
  "incident-form.tsx",
  "employee-active-toggle.tsx",
  "invoice-review-table.tsx",
  "promo-settings-form.tsx",
  "settings-form.tsx",
  "subscription-form.tsx",
  "package-manager.tsx",
];

describe("action Platform Owner menyegarkan cache klien", () => {
  for (const name of MUTATING_COMPONENTS) {
    it(`${name} memanggil router.refresh() setelah mutasi`, () => {
      const source = read(name);
      expect(source, name).toContain("useRouter");
      expect(source, name).toContain("router.refresh()");
    });
  }
});
