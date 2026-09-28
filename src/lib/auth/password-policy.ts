/**
 * Kebijakan password minimum untuk pendaftaran.
 *
 * Nilai ini sebelumnya hanya hidup di signupAction (`length < 8`). Form signup
 * juga butuh nilai yang sama untuk mengaktifkan tombol, jadi kalau ditulis dua
 * kali, satu sisi bisa tidak ikut berubah: form akan menawarkan tombol yang
 * server tolak, atau menahan tombol yang server sebenarnya terima.
 *
 * Satu konstanta, dipakai di kedua sisi.
 */
export const MIN_PASSWORD_LENGTH = 8;

export function meetsPasswordLength(value: string): boolean {
  return value.length >= MIN_PASSWORD_LENGTH;
}
