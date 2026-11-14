import { PublicBanner } from "@/components/public/public-banner";

/**
 * Bagian atas halaman Lacak: slider banner + tagline.
 *
 * Logo, nama toko, dan tombol WhatsApp ada di `PublicTopNav` supaya banner
 * bisa memakai seluruh lebar dan berganti gambar tanpa menggeser navigasi.
 */
export function PublicHeader({
  bannerUrls,
  tagline,
}: {
  bannerUrls: string[];
  tagline: string | null;
}) {
  return (
    <div>
      <PublicBanner images={bannerUrls} />
      {tagline ? (
        <p className="mx-auto w-full max-w-3xl px-6 pt-6 pb-6 text-center font-heading text-xl font-bold leading-snug">
          {tagline}
        </p>
      ) : null}
    </div>
  );
}
