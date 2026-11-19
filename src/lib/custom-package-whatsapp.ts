export const CUSTOM_PACKAGE_MESSAGE = `Halo Admin Kaggo, saya ingin tanya paket custom sesuai kebutuhan toko saya.

Nama toko:
Jumlah cabang:
Jumlah user:
Kebutuhan khusus:

Mohon info detail & penawarannya. Terima kasih.`;

export function buildCustomPackageWhatsAppUrl(number: string | undefined | null): string {
  const digits = (number ?? "").replace(/\D/g, "");
  if (!digits) return "#harga";
  return `https://wa.me/${digits}?text=${encodeURIComponent(CUSTOM_PACKAGE_MESSAGE)}`;
}

/** Pesan penawaran Custom dengan angka yang sudah dihitung ulang di server. */
export function buildCustomQuoteWhatsAppUrl(
  number: string | undefined | null,
  quote: {
    branches: number;
    employees: number;
    services: number;
    monthly: number;
    annual: number;
    whatsappQuota: number;
  },
): string {
  const digits = (number ?? "").replace(/\D/g, "");
  if (!digits) return "#harga";
  const rupiah = (value: number) =>
    `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`;
  const message = `Halo Admin Kaggo, saya ingin paket Custom / Pay as You Grow.

Kebutuhan:
- Cabang: ${quote.branches}
- Karyawan aktif: ${quote.employees}
- Kapasitas servis: ${quote.services} tiket/bulan
- Kuota WhatsApp: ${quote.whatsappQuota} pesan/bulan

Estimasi:
- Bulanan: ${rupiah(quote.monthly)}
- Tahunan: ${rupiah(quote.annual)}

Mohon konfirmasi penawarannya. Terima kasih.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
