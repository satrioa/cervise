/** Pemetaan error pembuatan tenant ke pesan yang bisa ditindaklanjuti owner. */
export function friendlyCreateTenantError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("23505") || message.toLowerCase().includes("duplicate key")) {
    if (message.includes("organizations_slug")) return "Nama tenant sudah dipakai. Gunakan nama lain.";
    if (message.includes("users_phone") || message.includes("users_email")) {
      return "Email atau WhatsApp sudah terdaftar pada akun lain.";
    }
    return "Data sudah terdaftar. Periksa nama, email, dan WhatsApp.";
  }
  return message || "Gagal membuat tenant";
}
