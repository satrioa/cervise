/**
 * Abstraksi provider pembayaran.
 *
 * Duitku sudah dipilih sebagai gateway, tetapi merchant belum terverifikasi.
 * Jangan ada panggilan API live, kredensial palsu, atau simulasi pembayaran
 * sukses sampai merchant disetujui. Transfer manual satu-satunya provider aktif.
 */

export type PaymentProviderId = "manual_transfer" | "duitku";
export type PaymentProviderState = "active" | "not_configured";

export type PaymentProvider = {
  id: PaymentProviderId;
  label: string;
  state: PaymentProviderState;
  /** Teks yang ditampilkan ke UI. Bukan janji bahwa checkout tersedia. */
  notice: string;
};

export const PAYMENT_PROVIDERS: readonly PaymentProvider[] = [
  {
    id: "manual_transfer",
    label: "Transfer bank manual",
    state: "active",
    notice: "Transfer ke rekening platform owner, unggah bukti, lalu tunggu verifikasi.",
  },
  {
    id: "duitku",
    label: "Duitku",
    state: "not_configured",
    notice: "NOT CONFIGURED / PENDING MERCHANT APPROVAL",
  },
] as const;

export const ACTIVE_PAYMENT_PROVIDER = PAYMENT_PROVIDERS.find(
  (provider) => provider.state === "active",
)!;

/** Dipakai UI: jangan pernah menampilkan checkout Duitku sebelum aktif. */
export function isProviderCheckoutAvailable(id: PaymentProviderId): boolean {
  const provider = PAYMENT_PROVIDERS.find((item) => item.id === id);
  return provider?.state === "active" && id !== "duitku";
}

/**
 * Tempat tunggal untuk integrasi Duitku di masa depan. Sengaja melempar:
 * tidak ada kredensial, tidak ada sandbox palsu, tidak ada checkout palsu.
 */
export function getDuitkuCheckout(): never {
  throw new Error("Duitku belum dikonfigurasi: menunggu persetujuan merchant.");
}
