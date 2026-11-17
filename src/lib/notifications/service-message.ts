// Teks pesan WhatsApp. Murni: tidak menyentuh database, jaringan, atau env,
// sehingga bisa diuji langsung dan dipakai dari mana saja.
//
// Tidak ada fallback fiktif. Field yang kosong berarti barisnya dihilangkan,
// bukan diisi teks karangan, mengikuti print-templates.tsx. Karena itu tidak
// ada baris "No. Servis: " tanpa isi: baris berlabel hanya dibuat kalau
// nilainya ada.

import type { TemplateParameter } from "@/lib/meta-wa";

export type ServiceMessageInput = {
  storeName: string;
  tenantSlug: string | null;
  serviceId: string;
  serviceNumber: string | null;
  device: string;
  complaint: string | null;
  trackingCode: string | null;
  status: string | null;
  /** Bisa null: task berikutnya membacanya dari env yang belum terkonfigurasi. */
  siteOrigin: string | null;
  priceEstimasi: number | null;
  garansiValue: number | null;
  garansiUnit: "hari" | "bulan" | "tahun" | null;
};

/** Nilai yang siap ditampilkan: null kalau kosong, string kalau isi. */
function present(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function joinLines(lines: (string | null | undefined)[]): string {
  return lines
    .map((line) => (line ?? "").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/** "No. Servis : x" -> "No. Servis: x". Kolom rata hanya enak dibaca di kode. */
function label(text: string): string {
  return text.replace(/\s+:\s+/, ": ");
}

/** Baris berlabel, atau null kalau nilainya kosong. */
function field(name: string, value: string | null | undefined): string | null {
  const shown = present(value);
  return shown === null ? null : label(`${name} : ${shown}`);
}

/**
 * Asal situs tanpa garis miring di ujung. Menahan null/undefined juga supaya
 * origin yang belum terkonfigurasi di environment melempar tautan kosong,
 * bukan membuat worker pengiriman mati.
 */
function trimOrigin(origin: string | null | undefined): string {
  return (present(origin) ?? "").replace(/\/+$/, "");
}

/**
 * Tautan halaman lacak publik. Mengembalikan string kosong kalau ada satu saja
 * bagian yang tidak ada, supaya tidak pernah terkirim tautan yang berakhir di
 * segmen kosong. Garis miring ganda di tetapkan di sini, bukan hanya di pemanggil.
 */
export function publicLacakUrl(
  siteOrigin: string | null | undefined,
  tenantSlug: string | null,
  trackingCode: string | null,
): string {
  const origin = trimOrigin(siteOrigin);
  const slug = present(tenantSlug);
  const code = present(trackingCode);
  if (!origin || !slug || !code) return "";
  return `${origin}/${slug}/lacak/${code}`;
}

/** Tautan internal untuk teknisi. String kosong kalau tidak bisa disusun. */
function internalServisUrl(
  siteOrigin: string | null | undefined,
  serviceId: string,
): string {
  const origin = trimOrigin(siteOrigin);
  const id = present(serviceId);
  if (!origin || !id) return "";
  return `${origin}/app/servis/${id}`;
}

/**
 * Nomor servis sebagai penanda, atau nama perangkat kalau nomornya belum ada.
 * Nomor servis tidak selalu terisi untuk servis lama.
 */
function serviceRef(input: ServiceMessageInput): string | null {
  return present(input.serviceNumber) ?? present(input.device);
}

/**
 * Baris judul. Nama toko tidak pernah dikarang kalau kosong: pemisah " - "
 * ikut hilang supaya tidak ada baris yang diawali tanda hubung tanpa isi.
 */
function heading(storeName: string | null | undefined, text: string): string {
  const name = present(storeName);
  return name ? `${name} - ${text}` : text;
}

export function buildCustomerCreatedMessage(input: ServiceMessageInput): string {
  const lacakUrl = publicLacakUrl(input.siteOrigin, input.tenantSlug, input.trackingCode);
  return joinLines([
    heading(input.storeName, "Servis diterima"),
    field("No. Servis", input.serviceNumber),
    field("Perangkat", input.device),
    field("Keluhan", input.complaint),
    field("Kode cek", input.trackingCode),
    field("Cek status", lacakUrl),
  ]);
}

export function buildCustomerStatusMessage(input: ServiceMessageInput): string {
  const lacakUrl = publicLacakUrl(input.siteOrigin, input.tenantSlug, input.trackingCode);
  const ref = serviceRef(input);
  return joinLines([
    ref
      ? heading(input.storeName, `Status servis ${ref}`)
      : heading(input.storeName, "Status servis"),
    field("Perangkat", input.device),
    field("Status", input.status),
    field("Kode cek", input.trackingCode),
    field("Cek status", lacakUrl),
  ]);
}

export function buildTechnicianCreatedMessage(input: ServiceMessageInput): string {
  return joinLines([
    heading(input.storeName, "Servis baru masuk"),
    serviceRef(input),
    field("Keluhan", input.complaint),
    field("Buka", internalServisUrl(input.siteOrigin, input.serviceId)),
  ]);
}

/**
 * Parameter template tidak boleh kosong: Meta menolak value "". Field yang
 * tidak ada diganti "-", bukan teks karangan yang terlihat seperti data.
 */
function param(value: string | null | undefined): TemplateParameter {
  return { type: "text", value: present(value) ?? "-" };
}

export function buildCustomerInvoiceParameters(input: ServiceMessageInput): TemplateParameter[] {
  const estimate =
    input.priceEstimasi !== null &&
    Number.isFinite(input.priceEstimasi) &&
    input.priceEstimasi > 0
      ? `Rp ${new Intl.NumberFormat("id-ID").format(input.priceEstimasi)}`
      : "Menunggu pemeriksaan";
  const warranty =
    input.garansiValue !== null && input.garansiUnit
      ? `${input.garansiValue} ${input.garansiUnit}`
      : "-";

  return [
    param(input.storeName),
    param(input.serviceNumber ?? input.device),
    param(input.device),
    param(input.complaint),
    { type: "text", value: estimate },
    { type: "text", value: warranty },
    param(publicLacakUrl(input.siteOrigin, input.tenantSlug, input.trackingCode)),
  ];
}

export function buildCustomerStatusParameters(input: ServiceMessageInput): TemplateParameter[] {
  return [
    param(input.storeName),
    param(serviceRef(input)),
    param(input.device),
    param(input.status),
    param(input.trackingCode),
    param(publicLacakUrl(input.siteOrigin, input.tenantSlug, input.trackingCode)),
  ];
}

export function buildTechnicianJobParameters(input: ServiceMessageInput): TemplateParameter[] {
  return [
    param(input.storeName),
    param(serviceRef(input)),
    param(input.device),
    param(input.complaint),
    param(internalServisUrl(input.siteOrigin, input.serviceId)),
  ];
}
