import { readLacakAppearance, type LacakAppearance } from "@/lib/operational/lacak-appearance";
import { publicPhotoUrl } from "@/lib/photos";
import { safeExternalUrl } from "./testimonial";

/** Slider halaman Lacak: tiga slot sudah cukup dan menjaga beban gambar. */
export const MAX_BANNERS = 3;

export type LandingBranch = {
  id: string;
  name: string;
  city?: string | null;
  phone?: string | null;
  is_active?: boolean;
  created_at?: string | null;
};

export type LandingRow = {
  name: string;
  slug: string;
  logo_url: string | null;
  banner_urls?: string[] | null;
  banner_url?: string | null;
  tagline: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  x_url?: string | null;
  youtube_url?: string | null;
  whatsapp_url?: string | null;
  maps_url?: string | null;
  footer_note?: string | null;
  lacak_appearance: unknown;
  branches: LandingBranch[] | null;
};

export type PublicTenant = {
  name: string;
  slug: string;
  logoUrl: string | null;
  branchName: string | null;
  appearance: LacakAppearance;
  bannerUrls: string[];
  tagline: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  websiteUrl: string | null;
  facebookUrl: string | null;
  xUrl: string | null;
  youtubeUrl: string | null;
  whatsappUrl: string | null;
  mapsUrl: string | null;
  footerNote: string | null;
  branchAddress: string | null;
  branchPhone: string | null;
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
    bannerUrls: (Array.isArray(row.banner_urls) ? row.banner_urls : [])
      .map((path) => (typeof path === "string" ? urlFoto(path) : null))
      .filter((url): url is string => url !== null)
      .slice(0, MAX_BANNERS),
    tagline: textOrNull(row.tagline),
    instagramUrl: safeExternalUrl(row.instagram_url),
    tiktokUrl: safeExternalUrl(row.tiktok_url),
    websiteUrl: safeExternalUrl(row.website_url),
    facebookUrl: safeExternalUrl(row.facebook_url),
    xUrl: safeExternalUrl(row.x_url),
    youtubeUrl: safeExternalUrl(row.youtube_url),
    whatsappUrl: safeExternalUrl(row.whatsapp_url),
    mapsUrl: safeExternalUrl(row.maps_url),
    footerNote: textOrNull(row.footer_note),
    // `branches.city` berisi alamat jalan, bukan nama kota: form admin menulis
    // field berlabel "alamat" ke kolom ini (src/app/app/cabang/actions.ts).
    branchAddress: textOrNull(cabang?.city),
    branchPhone: textOrNull(cabang?.phone),
  };
}