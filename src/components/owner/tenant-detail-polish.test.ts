import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const form = read("src/components/owner/subscription-form.tsx");

describe("SubscriptionForm", () => {
  it("hanya satu form pengaturan, tanpa status akses manual", () => {
    expect(form.match(/<form/g) ?? []).toHaveLength(1);
    expect(form).toContain("Pengaturan langganan");
    expect(form).not.toContain("updateTenantSubscription");
    expect(form).not.toContain("LIFECYCLE_STATUSES");
    expect(form).not.toContain("Ubah status akses");
  });

  it("grace days 0 tetap diteruskan", () => {
    expect(form).toContain("value={graceDays}");
    expect(form).toContain("adjustTenantSubscription(");
  });

  it("tanpa subscription memakai paket pertama dan grace 3", () => {
    expect(form).toContain('subscription?.package_id ?? packages[0]?.id ?? ""');
    expect(form).toContain("String(subscription?.grace_days ?? 3)");
    expect(form).toContain('subscription?.custom_monthly_price === null || !subscription ? ""');
  });
});
