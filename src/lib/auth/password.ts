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

/** Sisa buffer byte dari panggilan terakhir; lihat `randomChars`. */
let carry = new Uint8Array(0);

/**
 * `length` karakter acak seragam dari alfabet, dengan satu panggilan
 * `getRandomValues` per potong.
 *
 * Dua hal yang dijaga di sini:
 *
 * 1. Tidak ada modulo bias. Alfabet 58 bukan kelipatan 256, jadi 232 byte
 *    pertama memberi setiap huruf 4 slot sedangkan 24 byte sisanya berulang ke
 *    24 huruf pertama - huruf pertama jadi muncul sekitar 1,25x lebih sering.
 *    Byte di "ekor" itu dibuang, bukan dipakai.
 * 2. Byte diambil sepotong, bukan satu per karakter. Versi lama melakukan satu
 *    `getRandomValues` per karakter, yang berarti ratusan ribu panggilan untuk
 *    test yang mengambil 30.000 sampel, dan itu cukup untuk melewati batas
 *    waktu test di mesin lambat.
 *
 * Sisa buffer disimpan di `carry` supaya byte yang terbuang oleh rejection
 * sampling tidak hilang.
 */
function randomChars(length: number): string {
  const limit = 256 - (256 % PASSWORD_ALPHABET.length);
  let buffer = carry;
  let offset = 0;
  let out = "";

  while (out.length < length) {
    if (offset >= buffer.length) {
      buffer = crypto.getRandomValues(new Uint8Array(length));
      offset = 0;
    }
    const byte = buffer[offset];
    offset += 1;
    if (byte < limit) out += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
  }

  carry = buffer.slice(offset);
  return out;
}

export function generateTempPassword(length: number = GENERATED_PASSWORD_LENGTH): string {
  const bodyLength = Math.max(1, length - PASSWORD_SUFFIX.length);
  return randomChars(bodyLength) + PASSWORD_SUFFIX;
}
