import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/dashboard/activity-card.tsx"),
  "utf8",
);

describe("ActivityCard tidak menyebabkan hydration mismatch", () => {
  it("memakai formatter rupiah deterministik, bukan yang baca localStorage", () => {
    expect(source).not.toContain("formatCurrencyPlain");
    expect(source).toMatch(/formatRupiah\(item\.amount\)/);
  });
});
