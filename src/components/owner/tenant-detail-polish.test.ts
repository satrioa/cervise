import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const form = read("src/components/owner/subscription-form.tsx");
const extend = read("src/components/owner/extend-subscription.tsx");
const detail = read("src/app/owner/tenants/[id]/page.tsx");

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

describe("ExtendSubscription", () => {
  it("tidak punya pilihan paket/harga dan mengirim nilai dari subscription", () => {
    expect(extend).not.toContain('id="extend-package"');
    expect(extend).not.toContain('id="extend-price"');
    expect(extend).not.toContain("getEffectiveMonthlyPrice");
    expect(extend).toContain('packageId: subscription?.package_id ?? ""');
    expect(extend).toContain("customPrice: subscription?.custom_monthly_price ?? null");
  });

  it("tetap menampilkan durasi, catatan, dan preview", () => {
    expect(extend).toContain('id="extend-duration"');
    expect(extend).toContain('id="extend-note"');
    expect(extend).toContain("preview.endsAt");
  });
});

describe("Tenant detail layout", () => {
  it("memakai ExtendSubscription tanpa prop packages", () => {
    const start = detail.indexOf("<ExtendSubscription");
    const body = detail.slice(start, start + 400);
    expect(body).toContain("organizationId={organization.id}");
    expect(body).toContain("subscription={subscription}");
    expect(body).toContain("monthlyPrice={");
    expect(body).not.toContain("packages=");
  });

  it("badge DB mismatch tetap tampil", () => {
    expect(detail).toContain("isMismatch");
    expect(detail).toContain("DB: {subscription?.status}");
  });

  it("tiga metrik utama dan detail sekunder hadir", () => {
    expect(detail).toContain("Harga / bulan");
    expect(detail).toContain("Akses s/d");
    expect(detail).toContain("Periode mulai");
    expect(detail).toContain("Grace berakhir");
    expect(detail).toContain("Grace days");
  });
});
