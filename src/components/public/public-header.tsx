import { PublicBanner } from "@/components/public/public-banner";

/**
 * Bagian atas halaman Lacak: slider banner.
 *
 * Logo, nama toko, dan tombol WhatsApp ada di `PublicTopNav`. Tagline dirender
 * di dalam sheet konten supaya sheet bisa menumpuk di atas banner tanpa
 * menutupi teks itu.
 */
export function PublicHeader({ bannerUrls }: { bannerUrls: string[] }) {
  return <PublicBanner images={bannerUrls} />;
}
