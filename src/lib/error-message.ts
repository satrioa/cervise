/**
 * Penerjemah pesan error teknis → bahasa yang bisa ditindaklanjuti pengguna.
 *
 * Aturan utamanya PASS-THROUGH: pesan yang sudah ramah (mis. "Nama cabang
 * wajib") tidak diubah. Hanya pesan yang cocok pola teknis yang diganti,
 * supaya clue spesifik dari validasi tidak ikut hilang.
 */

const FALLBACK = "Terjadi masalah. Coba lagi.";
const MAX_LEN = 140;

const PATTERNS: { re: RegExp; message: string }[] = [
  { re: /23505|duplicate key/i, message: "Data sudah terdaftar. Periksa kembali." },
  { re: /23503|foreign key/i, message: "Data masih dipakai di transaksi lain." },
  { re: /42501|permission denied|row-level security/i, message: "Akses ditolak. Periksa hak akses Anda." },
  { re: /PGRST|JWT|\b401\b|\b403\b/i, message: "Sesi berakhir. Silakan masuk ulang." },
  { re: /Invalid login credentials/i, message: "Email atau password salah." },
  { re: /Email not confirmed/i, message: "Email belum terverifikasi. Cek kotak masuk Anda." },
  { re: /Failed to fetch|NetworkError|ERR_/i, message: "Koneksi terputus. Periksa internet lalu coba lagi." },
  { re: /ChunkLoadError|Loading chunk|removeChild/i, message: "Halaman perlu dimuat ulang." },
];

export function friendlyErrorMessage(error: unknown, fallback = FALLBACK): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");

  // Stack trace tidak pernah dibuka ke pengguna.
  if (/\n\s*at\s+\S+/.test(raw)) return fallback;

  const message = raw.replace(/[\r\n]+/g, " ").trim();
  if (!message || /^(\[object Object\]|undefined|null)$/i.test(message)) return fallback;

  const hit = PATTERNS.find((pattern) => pattern.re.test(message));
  // String minified panjang tanpa spasi juga teknis, walau tidak cocok pola atas.
  if (!hit && message.length > MAX_LEN && !/\s/.test(message)) return fallback;

  const result = hit ? hit.message : message;
  return result.length > MAX_LEN ? `${result.slice(0, MAX_LEN - 1)}…` : result;
}
