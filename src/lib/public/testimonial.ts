/**
 * URL aman untuk dipakai di `href`.
 *
 * Nilai ini berasal dari form admin tapi berakhir di halaman publik, jadi
 * `javascript:` harus ditolak eksplisit: pola `startsWith("http")` saja tidak
 * cukup karena huruf besar dan spasi di depan bisa lolos.
 */
export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (url.length === 0) return null;

  const protokol = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  if (!protokol) return null;
  const skema = protokol[1].toLowerCase();
  if (skema !== "http" && skema !== "https") return null;

  // "//evil.com" tidak punya skema jadi sudah gugur di atas; ini menangkap sisa
  // seperti "https:/evil.com" yang tidak punya host.
  if (!/^https?:\/\/[^/\s]+/i.test(url)) return null;
  return url;
}
