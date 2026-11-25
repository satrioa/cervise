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
  priceEstimasi?: number | null;
  garansiValue?: number | null;
  garansiUnit?: "hari" | "bulan" | "tahun" | null;
  /** Field untuk template WA kustom; opsional supaya caller lama tetap kompil. */
  customerName?: string | null;
  tenantName?: string | null;
  branchName?: string | null;
  technicianName?: string | null;
};

/** Snapshot data shift untuk template buka/tutup shift. */
export type ShiftMessageInput = {
  tenant: string;
  cabang: string;
  userOpen: string;
  dateOpen: string;
  date: string;
  shiftOpenTime: string;
  userClose: string;
  shiftCloseTime: string;
  saldoAwal: number;
  saldoAkhir: number;
  /** Rincian laporan shift versi lengkap (template tutup detail). */
  servis?: number;
  penjualan?: number;
  kasManual?: number;
  kasDiharapkan?: number;
  selisih?: number;
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
 * Nama variabel harus sama dengan `{{nama}}` di template Meta.
 */
function param(name: string, value: string | null | undefined): TemplateParameter {
  return { type: "text", parameter_name: name, value: present(value) ?? "-" };
}

export function buildCustomerInvoiceParameters(input: ServiceMessageInput): TemplateParameter[] {
  const estimate =
    typeof input.priceEstimasi === "number" &&
    Number.isFinite(input.priceEstimasi) &&
    input.priceEstimasi > 0
      ? `Rp ${new Intl.NumberFormat("id-ID").format(input.priceEstimasi)}`
      : "Menunggu pemeriksaan";
  const warranty =
    typeof input.garansiValue === "number" && input.garansiUnit
      ? `${input.garansiValue} ${input.garansiUnit}`
      : "-";

  return [
    param("store_name", input.storeName),
    param("service_number", serviceRef(input)),
    param("device", input.device),
    param("complaint", input.complaint),
    { type: "text", parameter_name: "estimate", value: estimate },
    { type: "text", parameter_name: "warranty", value: warranty },
    param("tracking_url", publicLacakUrl(input.siteOrigin, input.tenantSlug, input.trackingCode)),
  ];
}

export function buildCustomerStatusParameters(input: ServiceMessageInput): TemplateParameter[] {
  return [
    param("store_name", input.storeName),
    param("service_number", serviceRef(input)),
    param("device", input.device),
    param("status", input.status),
    param("tracking_code", input.trackingCode),
    param("tracking_url", publicLacakUrl(input.siteOrigin, input.tenantSlug, input.trackingCode)),
  ];
}

export function buildTechnicianJobParameters(input: ServiceMessageInput): TemplateParameter[] {
  return [
    param("store_name", input.storeName),
    param("service_number", serviceRef(input)),
    param("device", input.device),
    param("complaint", input.complaint),
    param("service_url", internalServisUrl(input.siteOrigin, input.serviceId)),
  ];
}

function rupiahValue(value: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID").format(value)}`;
}

/** Template `servis_masuk_v2` (customer, saat servis dibuat). */
export function buildServisMasukParameters(input: ServiceMessageInput): TemplateParameter[] {
  const estimate =
    typeof input.priceEstimasi === "number" && Number.isFinite(input.priceEstimasi) && input.priceEstimasi > 0
      ? rupiahValue(input.priceEstimasi)
      : "Menunggu pemeriksaan";
  return [
    param("customer", input.customerName),
    param("device", input.device),
    param("nomor_servis", serviceRef(input)),
    param("complaint", input.complaint),
    { type: "text", parameter_name: "estimated", value: estimate },
    param("tenant", input.tenantName ?? input.storeName),
    param("cabang", input.branchName),
  ];
}

/** Template status customer: body `{{device}}, {{service_number}}` (nama customer ada di header). */
export function buildServisStatusParameters(input: ServiceMessageInput): TemplateParameter[] {
  return [
    param("device", input.device),
    param("service_number", serviceRef(input)),
  ];
}

/** Template `servis_baru_teknisi_v1` (approved): nama teknisi ada di header. */
export function buildTechnicianParameters(input: ServiceMessageInput): TemplateParameter[] {
  return [
    param("nama_teknisi", input.technicianName),
    param("device", input.device),
    param("complaint", input.complaint),
    param("service_number", serviceRef(input)),
  ];
}

/** Template `shift_open_v1`. */
export function buildShiftOpenParameters(input: ShiftMessageInput): TemplateParameter[] {
  return [
    param("tenant", input.tenant),
    param("cabang", input.cabang),
    param("user_open", input.userOpen),
    param("date_open", input.dateOpen),
    { type: "text", parameter_name: "saldo_awal", value: rupiahValue(input.saldoAwal) },
  ];
}

/** Template `shift_close_v1`. */
/**
 * Template tutup shift versi lengkap (14 variabel). Teks statis sengaja
 * panjang supaya rasio variabel terhadap panjang pesan masih diterima Meta.
 */
export function buildShiftClosedParameters(input: ShiftMessageInput): TemplateParameter[] {
  return [
    param("tenant", input.tenant),
    param("cabang", input.cabang),
    param("tanggal", input.date),
    param("user_buka", input.userOpen),
    param("jam_buka", input.shiftOpenTime),
    param("user_tutup", input.userClose),
    param("jam_tutup", input.shiftCloseTime),
    { type: "text", parameter_name: "saldo_awal", value: rupiahValue(input.saldoAwal) },
    { type: "text", parameter_name: "servis", value: rupiahValue(input.servis ?? 0) },
    { type: "text", parameter_name: "penjualan", value: rupiahValue(input.penjualan ?? 0) },
    { type: "text", parameter_name: "kas_manual", value: rupiahValue(input.kasManual ?? 0) },
    { type: "text", parameter_name: "kas_diharapkan", value: rupiahValue(input.kasDiharapkan ?? input.saldoAwal) },
    { type: "text", parameter_name: "saldo_akhir", value: rupiahValue(input.saldoAkhir) },
    { type: "text", parameter_name: "selisih", value: rupiahValue(input.selisih ?? 0) },
  ];
}
