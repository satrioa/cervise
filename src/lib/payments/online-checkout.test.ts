import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCheckoutPayload,
  checkoutEndpoint,
  isPaidWebhook,
  verifyWebhookSignature,
} from "./online-checkout";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("checkout online", () => {
  it("memakai order_id invoice & nominal dari invoice", () => {
    const payload = buildCheckoutPayload({
      orderId: "INV-202611-0001",
      grossAmount: 199000,
      firstName: "Budi",
      email: "budi@toko.id",
      phone: "08123456789",
    });
    expect(payload.transaction_details).toEqual({
      order_id: "INV-202611-0001",
      gross_amount: 199000,
    });
    expect(payload.customer_details.email).toBe("budi@toko.id");
  });

  it("endpoint sandbox berubah saat production", () => {
    expect(checkoutEndpoint(false)).toContain("sandbox");
    expect(checkoutEndpoint(true)).not.toContain("sandbox");
  });
});

describe("verifikasi webhook", () => {
  const serverKey = "server-key-rahasia";
  const body = {
    order_id: "INV-202611-0001",
    status_code: "200",
    gross_amount: "199000.00",
  };
  const signature = createHash("sha512")
    .update(`${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`)
    .digest("hex");

  it("menerima signature yang benar", () => {
    expect(verifyWebhookSignature({ ...body, signature_key: signature }, serverKey)).toBe(true);
  });

  it("menolak signature salah atau field kurang", () => {
    expect(verifyWebhookSignature({ ...body, signature_key: "abc" }, serverKey)).toBe(false);
    expect(verifyWebhookSignature({ ...body, signature_key: signature }, "salah")).toBe(false);
    expect(verifyWebhookSignature({ ...body }, serverKey)).toBe(false);
  });

  it("hanya konfirmasi pembayaran yang diterima", () => {
    expect(isPaidWebhook({ transaction_status: "settlement", fraud_status: "accept" })).toBe(true);
    expect(isPaidWebhook({ transaction_status: "capture", fraud_status: "accept" })).toBe(true);
    expect(isPaidWebhook({ transaction_status: "pending" })).toBe(false);
    expect(isPaidWebhook({ transaction_status: "settlement", fraud_status: "challenge" })).toBe(false);
  });
});

describe(" UI tidak menyebut nama gateway", () => {
  const files = [
    "src/components/billing/topup-purchase-flow.tsx",
    "src/components/billing/wa-topup-panel.tsx",
    "src/app/app/pengaturan/usage/beli/page.tsx",
    "src/app/owner/settings/page.tsx",
  ];
  for (const file of files) {
    it(file, () => {
      const source = read(file);
      expect(source.toLowerCase()).not.toContain("midtrans");
      expect(source.toLowerCase()).not.toContain("duitku");
    });
  }
});
