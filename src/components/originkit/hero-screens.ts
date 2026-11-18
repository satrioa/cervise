import type { ImageItem } from "@/components/phone-carousel";
import type { DashboardFeedItem } from "@/lib/operational/dashboard";

/**
 * Screenshot layar aplikasi untuk carousel HP di hero.
 * Taruh file di public/originkit/ dengan nama ini saat gambar sudah tersedia.
 */
export const HERO_PHONE_SCREENS: ImageItem[] = [
  { src: "/originkit/screen-1.png", alt: "Tampilan dashboard Kaggo" },
  { src: "/originkit/screen-2.png", alt: "Tampilan daftar servis Kaggo" },
  { src: "/originkit/screen-3.png", alt: "Tampilan kas dan laporan Kaggo" },
];

const now = new Date().toISOString();

/** Contoh aktivitas untuk kartu Activity di sekitar mockup. */
export const HERO_ACTIVITY_FEED: DashboardFeedItem[] = [
  {
    id: "hero-feed-1",
    kind: "service",
    action: "status_change",
    actionLabel: "Selesai",
    title: "Servis iPhone 13 selesai",
    detail: "Teknisi Andi menyelesaikan perbaikan layar",
    actor: "Andi",
    serviceId: "SRV-2026-0012",
    device: "iPhone 13",
    amount: 250000,
    createdAt: now,
  },
  {
    id: "hero-feed-2",
    kind: "transaction",
    action: "payment",
    actionLabel: "Lunas",
    title: "Pembayaran kas masuk",
    detail: "Servis Redmi Note 11 dibayar tunai",
    actor: "Sari",
    serviceId: "SRV-2026-0010",
    device: "Redmi Note 11",
    amount: 180000,
    createdAt: now,
  },
];
