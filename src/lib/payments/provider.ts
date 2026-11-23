/**
 * Abstraksi provider pembayaran. Nama gateway sengaja tidak diekspos ke UI —
 * pengguna hanya melihat "pembayaran online" dan halaman checkout generik.
 */
export type PaymentProviderId = "online_checkout";
export type PaymentProviderState = "active" | "not_configured";

export type PaymentProvider = {
  id: PaymentProviderId;
  label: string;
  state: PaymentProviderState;
  notice: string;
};

export const PAYMENT_PROVIDERS: readonly PaymentProvider[] = [
  {
    id: "online_checkout",
    label: "Pembayaran online",
    state: "active",
    notice: "Pembayaran diverifikasi otomatis; kuota aktif setelah konfirmasi.",
  },
] as const;

export const ACTIVE_PAYMENT_PROVIDER: PaymentProvider = PAYMENT_PROVIDERS[0];

export function isProviderCheckoutAvailable(id: PaymentProviderId): boolean {
  return PAYMENT_PROVIDERS.some((provider) => provider.id === id && provider.state === "active");
}
