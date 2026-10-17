import { readLacakAppearance, type LacakAppearance } from "@/lib/operational/lacak-appearance";
import { publicPhotoUrl } from "@/lib/photos";
import { readTestimonials, safeExternalUrl, type Testimonial } from "./testimonial";

export type LandingBranch = {
  id: string;
  name: string;
  city?: string | null;
  phone?: string | null;
  is_active?: boolean;
  created_at?: string | null;
};

export type LandingTestimonialRow = {
  id: string;
  nama: string;
  isi: string;
  rating: number | null;
  urutan: number;
  is_active: boolean;
  created_at: string;
};

export type LandingRow = {
  name: string;
  slug: string;
  logo_url: string | null;
  banner_url: string | null;
  tagline: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  lacak_appearance: unknown;
  branches: LandingBranch[] | null;
  lacak_testimonials: LandingTestimonialRow[] | null;
};

export type PublicTenant = {
  name: string;
  slug: string;
  logoUrl: string | null;
  branchName: string | null;
  appearance: LacakAppearance;
  bannerUrl: string | null;
  tagline: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  branchAddress: string | null;
  branchPhone: string | null;
  testimonials: Testimonial[];
};

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Cabang mana yang dipakai untuk blok "kontak".
 *
 * Steelama ini dipilih dengan `find(b => b.logo_url)`, dan karena
 * `branches.logo_url` tidak pernah ditulis oleh kode mana pun, itu selalu
 * jatuh ke cabang pertama apa pun urutan barisnya - hasilnya bisa bergeser
 * tanpa ada yang mengubah data. Sekarang: aktif, lalu paling lama dibuat.
 */
export function pickLandingBranch(branches: LandingBranch[] | null | undefined): LandingBranch | null {
  const daftar = Array.isArray(branches) ? branches : [];
  return (
    [...daftar]
      .filter((branch) => branch && typeof branch === "object" && branch.is_active !== false)
      .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))[0] ?? null
  );
}

/**
 * Satu-satunya pemetaan baris database menjadi data halaman Lacak.
 *
 * Halaman publik dan panel pratinjau di /app/pengaturan/tampilan keduanya
 * memanggil ini, supaya apa yang dipratinjau tidak mungkin melenceng dari
 * yang dilihat pengunjung.
 */
export function toPublicTenant(row: LandingRow, storageBase: string): PublicTenant {
  const cabang = pickLandingBranch(row.branches);
  // Tanpa SUPABASE_URL, `publicPhotoUrl` tetap merakit URL relatif yang
  // tidak akan pernah bisa dimuat. Lebih baik logo kosong daripada gambar
  // rusak di header toko orang.
  const base = typeof storageBase === "string" ? storageBase.trim() : "";
  const urlFoto = (path: string | null) => (base.length > 0 ? publicPhotoUrl(base, path) : null);

  return {
    name: row.name,
    slug: row.slug,
    // Logo dan banner milik TENANT (organizations). branches.logo_url tidak
    // pernah ditulis kode mana pun, jadi tidak boleh jadi sumbernya.
    logoUrl: urlFoto(row.logo_url),
    branchName: textOrNull(cabang?.name),
    appearance: readLacakAppearance(row.lacak_appearance),
    bannerUrl: urlFoto(row.banner_url),
    tagline: textOrNull(row.tagline),
    instagramUrl: safeExternalUrl(row.instagram_url),
    tiktokUrl: safeExternalUrl(row.tiktok_url),
    // `branches.city` berisi alamat jalan, bukan nama kota: form admin menulis
    // field berlabel "alamat" ke kolom ini (src/app/app/cabang/actions.ts).
    branchAddress: textOrNull(cabang?.city),
    branchPhone: textOrNull(cabang?.phone),
    testimonials: readTestimonials(row.lacak_testimonials),
  };
}