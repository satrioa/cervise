import { buildWhatsAppUrl } from "@/lib/billing/renewal";

export type TopupWaInput = {
  invoiceNumber: string;
  tenantName: string;
  packageName: string;
  quantity: number;
  amount: number;
  adminWhatsapp: string;
};

/** Pesan konfirmasi transfer top-up. Sengaja tanpa link bukti: owner mengecek bukti di dashboard. */
export function buildTopupWaMessage(input: TopupWaInput) {
  return [
    "Halo Admin Kaggo, saya sudah transfer pembayaran top-up WhatsApp.",
    "",
    `Invoice: ${input.invoiceNumber}`,
    `Tenant: ${input.tenantName}`,
    `Paket: ${input.packageName} — ${input.quantity.toLocaleString("id-ID")} pesan`,
    `Nominal: Rp${input.amount.toLocaleString("id-ID")}`,
    "",
    "Bukti transfer sudah diunggah. Mohon dicek dan dikonfirmasi di dashboard owner. Terima kasih.",
  ].join("\n");
}

export function buildTopupWaUrl(input: TopupWaInput) {
  return buildWhatsAppUrl(input.adminWhatsapp, buildTopupWaMessage(input));
}
