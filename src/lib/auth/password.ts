/**
 * Pembuat password sementara untuk akun yang dibuat admin.
 *
 * Modul ini murni dan bisa diuji tanpa database.
 */

/**
 * Alfabet tanpa huruf yang mudah tertukar (I/l/1, O/0, 0/O) dan tanpa tanda
 * baca yang menyulitkan copy-paste dari terminal. Panjang 58, bukan kelipatan
 * 256, jadi pengambilan indeks harus memakai rejection sampling - lihat
 * randomChar di bawah.
 */
export const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Digit + simbol yang selalu ditambahkan agar password memenuhi syarat umum. */
const PASSWORD_SUFFIX = "1!";

export const GENERATED_PASSWORD_LENGTH = 12;

/**
 * Satu karakter acak seragam dari alfabet.
 *
 * Versi lama memakai `byte % 58` langsung. Dengan 256 byte dan alfabet 58,
 * 232 byte pertama memberi setiap huruf 4 slot, sedangkan 24 byte sisanya
 * berulang ke 24 huruf pertama - jadi huruf pertama muncul sekitar 1,25x
 * lebih sering dari huruf terakhir. Pola itu membuat password lebih mudah
 * ditebak. Di sini byte yang jatuh di "ekor" (>= batas kelipatan) dibuang
 * dan diundi ulang.
 */
function randomChar(): string {
  const limit = 256 - (256 % PASSWORD_ALPHABET.length);
  for (;;) {
    const [byte] = crypto.getRandomValues(new Uint8Array(1));
    if (byte < limit) return PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
  }
}

export function generateTempPassword(length: number = GENERATED_PASSWORD_LENGTH): string {
  const bodyLength = Math.max(1, length - PASSWORD_SUFFIX.length);
  let out = "";
  for (let i = 0; i < bodyLength; i += 1) out += randomChar();
  return out + PASSWORD_SUFFIX;
}
