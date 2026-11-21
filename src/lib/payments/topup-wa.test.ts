import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTopupWaMessage, buildTopupWaUrl } from "./topup-wa";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");
const flow = read("src/components/billing/topup-purchase-flow.tsx");
const usage = read("src/app/app/pengaturan/usage/pengaturan-usage-client.tsx");
const panel = read("src/components/billing/wa-topup-panel.tsx");
const actions = read("src/app/app/pengaturan/usage/actions.ts");
const beli = read("src/app/app/pengaturan/usage/beli/page.tsx");
const settings = read("src/components/owner/settings-form.tsx");

const input = {
  invoiceNumber: "INV-202611-0001",
  tenantName: "JCellular",
  packageName: "Paket 1000",
  quantity: 1000,
  amount: 199000,
  adminWhatsapp: "08123456789",
};

describe("template WA konfirmasi top-up", () => {
  it("memuat invoice, tenant, paket, jumlah, dan nominal", () => {
    const message = buildTopupWaMessage(input);
    expect(message).toContain("INV-202611-0001");
    expect(message).toContain("JCellular");
    expect(message).toContain("Paket 1000");
    expect(message).toContain("1.000");
    expect(message).toContain("199.000");
  });

  it("tidak menyertakan link bukti dan mengarah ke wa.me admin", () => {
    const message = buildTopupWaMessage(input);
    expect(message).not.toMatch(/https?:\/\//);
    const url = buildTopupWaUrl(input);
    expect(url).toContain("https://wa.me/628123456789");
    expect(url).toContain(encodeURIComponent("INV-202611-0001"));
  });
});

describe("alur beli kuota WhatsApp", () => {
  it("tombol memakai label yang diminta", () => {
    expect(flow).toContain("Beli kuota WhatsApp");
  });

  it("halaman usage tidak lagi memuat pembelian inline", () => {
    expect(usage).toContain("<WaTopupPanel");
    expect(panel).toContain('/app/pengaturan/usage/beli');
    expect(panel).not.toContain("createTopupOrderAction");
    expect(panel).not.toContain("uploadPaymentProofAction");
  });

  it("halaman beli tersedia dan memuat rekening dari settings", () => {
    expect(beli).toContain("TopupPurchaseFlow");
    expect(beli).toContain("bank_name, bank_account_name, bank_account_number, owner_whatsapp");
    expect(settings).toContain('id="bank-account-number"');
  });

  it("status invoice tetap pending saat konfirmasi WA", () => {
    const start = actions.indexOf("export async function markTopupWaSentAction");
    const body = actions.slice(start, start + 2600);
    expect(body).toContain("wa_confirmation_sent_at");
    expect(body).not.toContain('status: "approved"');
    expect(body).toContain("invoice.status !== \"pending\"");
    expect(flow).toContain("markTopupWaSentAction");
  });
});
