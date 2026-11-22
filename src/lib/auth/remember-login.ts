const REMEMBER_EMAIL_KEY = "cervise_login_email";

/** Email yang disimpan saat user memilih "Ingat saya". Password tidak pernah disimpan. */
export function readRememberedEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveRememberedEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
  } catch {
    // localStorage bisa diblokir (mode privat/kebijakan browser) — login tetap jalan.
  }
}

export function clearRememberedEmail(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
  } catch {
    // Abaikan: tidak ada yang perlu dibersihkan kalau storage tidak tersedia.
  }
}
