import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("durasi trial mengikuti database", () => {
  it("helper membaca trial_days paket trial dengan fallback 5", () => {
    const source = read("src/lib/pricing/public.ts");
    expect(read("src/lib/pricing/trial-days.ts")).toContain("export const DEFAULT_TRIAL_DAYS = 5");
    expect(source).toContain('.eq("code", "trial")');
    expect(source).toContain('.select("trial_days")');
  });

  it("tidak ada teks trial 14 hari yang tersisa di UI", () => {
    const files = [
      "src/app/signup/signup-form.tsx",
      "src/components/onboarding/stepper.tsx",
      "src/components/billing/tenant-billing-view.tsx",
      "src/app/owner/page.tsx",
      "src/app/owner/new/page.tsx",
      "src/components/owner/create-tenant-dialog.tsx",
      "src/components/tenant/create-tenant-dialog.tsx",
    ];
    for (const file of files) {
      expect(read(file), file).not.toContain("14 hari");
      expect(read(file), file).toContain("trialDays");
    }
    expect(read("src/components/pricing-three-tier.tsx")).toContain("DEFAULT_TRIAL_DAYS");
  });
});
