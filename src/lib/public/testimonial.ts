export type TestimonialRow = {
  id: string;
  nama: string;
  isi: string;
  rating: number | null;
  urutan: number;
  is_active: boolean;
  created_at: string;
};

export type Testimonial = {
  id: string;
  nama: string;
  isi: string;
  rating: number | null;
};

const DEFAULT_LIMIT = 12;

function ratingValid(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}

/**
 * Menormalkan baris testimoni sebelum masuk halaman publik.
 *
 * Baris yang tidak lolos dibuang, bukan ditampilkan dengan nilai rusak: rating
 * di luar 1-5 atau bukan bilangan bulat jadi `null` (tanpa bintang) supaya
 * kartu tidak pernah menunjukkan jumlah bintang yang tidak bisa di Urgency.
 */
export function readTestimonials(rows: unknown, limit = DEFAULT_LIMIT): Testimonial[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row): row is TestimonialRow => typeof row === "object" && row !== null)
    .filter((row) => row.is_active === true)
    .map((row) => ({
      id: row.id,
      nama: String(row.nama ?? "").trim(),
      isi: String(row.isi ?? "").trim(),
      rating: ratingValid(row.rating),
      urutan: Number.isFinite(Number(row.urutan)) ? Number(row.urutan) : 0,
      created_at: String(row.created_at ?? ""),
    }))
    .filter((row) => row.nama.length > 0 && row.isi.length > 0)
    .sort((a, b) => a.urutan - b.urutan || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit))
    .map(({ nama, isi, rating, id }) => ({ id, nama, isi, rating }));
}

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