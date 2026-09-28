import type { GaransiMeta } from "@/lib/operational/garansi-meta";
import type { Stage } from "@/lib/operational/stage-track";

/**
 * Kolom yang boleh keluar dari halaman publik. Sengaja ditulis sebagai
 * konstanta supaya test bisa mengunci daftar ini: kalau ada kolom sensitif
 * yang menyusup ke sini, test gagal.
 *
 * Tidak pernah boleh keluar: password_value, password_type, imei1, imei2,
 * kondisi_awal, kelengkapan, price, customer_id, teknisi_id, created_by.
 * `id` dan `tracking_code` hanya dipakai server untuk membaca log status dan
 * tidak pernah dikirim ke klien.
 *
 * Kolom dan embed dipisah karena keduanya berbeda sifat: `teknisi_id` di
 * bawah hanya Petunjuk FK untuk join, bukan kolom yang dibaca atau dikirim.
 */
export const PUBLIC_SERVICE_SELECT_COLUMNS = [
  "id",
  "service_number",
  "tracking_code",
  "device",
  "status",
  "created_at",
  "garansi_value",
  "garansi_unit",
  "garansi_until",
] as const;

/** Relasi yang boleh di-embed, beserta kolom yang boleh diekspos. */
export const PUBLIC_SERVICE_EMBEDS = ["branches!inner(id, name)", "profiles!teknisi_id(full_name)"] as const;

export const PUBLIC_SERVICE_SELECT = [...PUBLIC_SERVICE_SELECT_COLUMNS, ...PUBLIC_SERVICE_EMBEDS].join(", ");

export const FORBIDDEN_PUBLIC_COLUMNS = [
  "password_value",
  "password_type",
  "imei1",
  "imei2",
  "kondisi_awal",
  "kelengkapan",
  "price",
  "price_estimasi",
  "customer_id",
  "teknisi_id",
  "created_by",
  "cervise_customers",
  "customers",
] as const;

export const PUBLIC_LOOKUP_UNAVAILABLE_MESSAGE =
  "Kode tidak ditemukan atau sudah tidak berlaku. Periksa kembali kode pada struk service Anda.";

export const PUBLIC_LOOKUP_RATE_LIMIT_MESSAGE =
  "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.";

export type PublicServisHistoryEntry = {
  at: string;
  from: string | null;
  to: string | null;
};

export type PublicServisResult = {
  serviceNumber: string | null;
  trackingCode: string;
  device: string;
  status: Stage;
  createdAt: string;
  branchName: string;
  teknisiName: string | null;
  garansiUntil: string | null;
  garansi: GaransiMeta;
  history: PublicServisHistoryEntry[];
};

export type PublicServisLookup =
  | { ok: true; result: PublicServisResult }
  | { ok: false; message: string };

const TRACKING_CODE_PATTERN = /^[0-9A-F]{10}$/;

/**
 * Kode dicetak sebagai 10 hex, tapi pelanggan sering mengetik dengan spasi,
 * tanda hubung, atau huruf kecil. Semua itu dinormalkan supaya tidak gagal
 * hanya karena format.
 */
export function normalizeTrackingCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!TRACKING_CODE_PATTERN.test(cleaned)) return null;
  return cleaned;
}

export function formatTrackingCode(code: string | null | undefined): string {
  const normalized = normalizeTrackingCode(code ?? "");
  if (!normalized) return "—";
  return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
}

const KNOWN_STAGES: Stage[] = [
  "Masuk",
  "Diagnosa",
  "Menunggu Konfirmasi",
  "Menunggu Sparepart",
  "Dikerjakan",
  "Selesai",
  "Sudah Diambil",
  "Batal",
];

export function coerceStage(value: unknown): Stage {
  return KNOWN_STAGES.includes(value as Stage) ? (value as Stage) : "Masuk";
}
