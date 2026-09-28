/**
 * Serialisasi mention di dalam teks catatan.
 *
 * Bentuk di database:
 *
 *   `Telp {{m:k3f9a}} soal IMEI`
 *
 * `{{m:token}}` preoccupation dengan teksnya sendiri, bukan indeks karakter.
 * Kalau posisinya disimpan sebagai nomor, setiap edit kalimat menggeser semua
 * indeks setelah titik yang diedit dan chip meleset ke tempat yang salah.
 * Dengan token, chip ikut bergeser sendiri karena menyatu dengan teksnya.
 *
 * Modul ini murni tanpa React supaya bisa diuji langsung. Komponen editor
 * hanya memanggil `parseMentionText` dan `toMentionToken`, tidak boleh
 * memanggil regex sendiri -- dua implementasi parser akan menyimpang.
 */

/** Token mention: 6-10 karakter alfanumerik kecil, dibungkus `{{m:...}}`. */
export const MENTION_TOKEN_RE = /\{\{m:([0-9a-z]{6,10})\}\}/g;

/** Panjang token baru. 6 base36 = 2 miliar kombinasi. */
const TOKEN_LENGTH = 6;
const TOKEN_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export type MentionSegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; token: string };

/** Bentuk `{{m:token}}` untuk satu token. */
export function toMentionToken(token: string): string {
  return `{{m:${token}}}`;
}

/**
 * Pecah teks ber-token menjadi segmen teks dan segmen mention.
 *
 * Token yang tidak dikenal TIDAK dierror dan TIDAK dibuang -- ia dikembalikan
 * sebagai segmen teks apa adanya. Kalau token hilang (mention dihapus),
 * catatan lama harus tetap menampilkan teksnya utuh; kegagalan di sini akan
 * menjadi catatan yang isinya hilang.
 */
export function parseMentionText(value: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let lastIndex = 0;

  // Regex dengan flag `g` menyimpan posisi terakhirnya, jadi dipakai ulang
  // dari state nol setiap panggilan; kalau tidak, panggilan kedua mulai dari
  // sisa yang tidak sengaja disisakan.
  MENTION_TOKEN_RE.lastIndex = 0;
  for (const match of value.matchAll(MENTION_TOKEN_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ kind: "text", text: value.slice(lastIndex, start) });
    }
    segments.push({ kind: "mention", token: match[1] });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < value.length) {
    segments.push({ kind: "text", text: value.slice(lastIndex) });
  }
  return segments;
}

/** Teks catatan tanpa token, untuk ditampilkan di luar editor. */
export function stripMentionTokens(value: string): string {
  return value.replace(MENTION_TOKEN_RE, "");
}

/**
 * Panjang teks yang benar-benar terlihat oleh pengguna.
 *
 * Batas 200 karakter harus dihitung dari angka ini. Menghitung dari string
 * yang sudah berisi token akan menolak catatan yang isinya jelas-jelas
 * pendek, dan pesannya tidak memberi petunjuk apa pun.
 */
export function visibleLength(value: string): number {
  return stripMentionTokens(value).trim().length;
}

/** Batas karakter teks terlihat. Tidak termasuk token. */
export const VISIBLE_TITLE_MAX = 200;

/**
 * Token baru yang belum dipakai di satu catatan.
 *
 * Client yang membuat tokennya sendiri, bukan memberi tahu server, supaya
 * judul bisa disusun lengkap dengan token SEBELUM catatan disimpan. Kalau
 * token baru dibuat server, penyusunan judul harus menunggu dua putaran
 * bolak-balik: simpan, ambil id, simpan lagi judulnya.
 */
export function newToken(used: readonly string[] = []): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let token = "";
    for (let i = 0; i < TOKEN_LENGTH; i += 1) {
      token += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)];
    }
    if (!used.includes(token)) return token;
  }
  // 50 percobaan dengan 2 miliar kombinasi praktis tidak mungkin gagal.
  // Kalau tetap gagal, lebih baik gagal keras daripada mengulang token yang
  // bentrok -- bentrok akan ditolak index unik dan mention hilang diam-diam.
  throw new Error("Gagal membuat token mention yang unik");
}

/** Token yang sudah dipakai di nilai ber-token tertentu. */
export function tokensIn(value: string): string[] {
  return parseMentionText(value)
    .filter((s): s is { kind: "mention"; token: string } => s.kind === "mention")
    .map((s) => s.token);
}
