import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const payment = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("checkout langganan memakai gateway yang sama dengan top-up", () => {
  it("webhook menerima invoice upgrade dan renewal", () => {
    const source = payment("src/app/api/webhooks/payment/route.ts");
    expect(source).toContain('.in("invoice_type", ["topup", "upgrade", "renewal"])');
    expect(source).toContain("payment_apply_fulfillment");
  });

  it("halaman subscription membuat redirect checkout dan kembali ke halaman subscription", () => {
    const action = payment("src/app/app/pengaturan/subscription/actions.ts");
    const view = payment("src/components/billing/tenant-billing-view.tsx");
    expect(action).toContain("createSubscriptionCheckoutAction");
    expect(action).toContain('returnPath: "/app/pengaturan/subscription"');
    expect(view).toContain("createSubscriptionCheckoutAction");
    expect(view).toContain("window.location.assign(result.redirectUrl)");
    expect(view).not.toContain("Bayar via WhatsApp");
  });
});
