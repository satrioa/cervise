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
