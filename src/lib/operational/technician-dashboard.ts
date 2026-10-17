import { dalamHariYangSama, dalamRentangBulan } from "./periode-bulan";

/**
 * Perhitungan untuk dashboard teknisi.
 *
 * Modul ini murni: tidak menyentuh database, tidak membaca `Date.now()`.
 * `now` selalu jadi parameter supaya hasilnya deterministik dan bisa diuji.
 * Pola yang sama dipakai `laporan-servis.ts` dan `performa-teknisi.ts`.
 */

/**
 * Bentuk baris servis dipakai bersama dengan `laporan-servis.ts`. Satu bentuk
 * untuk seluruh `@/lib/operational` supaya tidak ada dua definisi "baris
 * servis" yang bisa berbeda.
 */
export type TechnicianServiceInput = {
  id: string;
  service_number: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  branch_id: string;
  teknisi_id: string | null;
  status: string;
  price: number | null;
  device: string | null;
};

/** Kolom setting insentif di `public.branches`. */
export type BranchIntensif = {
  is_intensif_enabled: boolean;
  intensif_mode: string;
  intensif_value: number | null;
  intensif_target_count: number | null;
};

// ---------------------------------------------------------------------------
// Antrean "servis butuh perhatian"
// ---------------------------------------------------------------------------

export type AttentionPriority = "tinggi" | "sedang";

export type AttentionReason =
  | "belum-ditangani"
  | "menggantung-di-pengerjaan"
  | "sudah-selesai-belum-diambil";

export type AttentionItem = {
  id: string;
  serviceNumber: string | null;
  device: string;
  status: string;
  priority: AttentionPriority;
  reason: AttentionReason;
  hoursWaiting: number;
  waitingLabel: string;
};

export type AttentionThresholds = {
  /** `Masuk` lebih lama dari ini masuk antrean. */
  untouchedHours: number;
  /** `Dikerjakan` lebih lama dari ini masuk antrean. */
  inProgressHours: number;
  /** `Selesai` lebih lama dari ini masuk antrean (belum diambil). */
  readyHours: number;
};

export const DEFAULT_ATTENTION_THRESHOLDS: AttentionThresholds = {
  untouchedHours: 24,
  inProgressHours: 48,
  readyHours: 24,
};

const REASON_LABEL: Record<AttentionReason, string> = {
  "belum-ditangani": "Belum ditangani",
  "menggantung-di-pengerjaan": "Menggantung di pengerjaan",
  "sudah-selesai-belum-diambil": "Selesai, belum diambil",
};

function hoursBetween(from: string, now: Date): number {
  const then = new Date(from).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / 3_600_000));
}

function formatWaiting(hours: number): string {
  if (hours < 1) return "<1j";
  if (hours < 24) return `${hours}j`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest === 0 ? `${days}h` : `${days}h ${rest}j`;
}

/**
 * Antrean servis milik satu teknisi yang bermasalah, diurutkan dari yang
 * paling lama menunggu.
 *
 * Durasi dihitung dari `updated_at`, bukan `created_at`: servis yang sudah
 * ditangani lalu menggantung punya `updated_at` yang jauh lebih baru, dan di
 * situlah masalahnya terlihat. Servis yang masih `Masuk` tidak pernah di-update,
 * jadi untuk status itu keduanya sama.
 *
 * Status `Diagnosa`, `Menunggu Konfirmasi`, dan `Menunggu Sparepart` sengaja
 * tidak dimasukkan — ketiganya menunggu keputusan manusia, bukan kemacetan kerja.
 */
export function buildAttentionQueue(
  services: TechnicianServiceInput[],
  teknisiId: string | null,
  now: Date,
  thresholds: AttentionThresholds = DEFAULT_ATTENTION_THRESHOLDS,
): AttentionItem[] {
  if (!teknisiId) return [];

  const items: AttentionItem[] = [];

  for (const service of services) {
    if (service.teknisi_id !== teknisiId) continue;

    // Selesai/Sudah Diambil/Batal tidak boleh masuk antrean yang sama.
    if (service.status === "Sudah Diambil" || service.status === "Batal") continue;

    let reason: AttentionReason | null = null;
    let priority: AttentionPriority = "tinggi";
    let hours = 0;
    const since = service.updated_at;

    if (service.status === "Masuk") {
      if (hoursBetween(since, now) < thresholds.untouchedHours) continue;
      reason = "belum-ditangani";
      hours = hoursBetween(since, now);
    } else if (service.status === "Dikerjakan") {
      if (hoursBetween(since, now) < thresholds.inProgressHours) continue;
      reason = "menggantung-di-pengerjaan";
      hours = hoursBetween(since, now);
    } else if (service.status === "Selesai") {
      if (hoursBetween(since, now) < thresholds.readyHours) continue;
      reason = "sudah-selesai-belum-diambil";
      priority = "sedang";
      hours = hoursBetween(since, now);
    }

    if (!reason) continue;

    items.push({
      id: service.id,
      serviceNumber: service.service_number,
      device: service.device ?? "Tanpa perangkat",
      status: service.status,
      priority,
      reason,
      hoursWaiting: hours,
      waitingLabel: formatWaiting(hours),
    });
  }

  // Prioritas dulu, lalu yang paling lama menunggu.
  const weight: Record<AttentionPriority, number> = { tinggi: 0, sedang: 1 };
  return items.sort(
    (a, b) => weight[a.priority] - weight[b.priority] || b.hoursWaiting - a.hoursWaiting,
  );
}

export function attentionReasonLabel(reason: AttentionReason): string {
  return REASON_LABEL[reason];
}

// ---------------------------------------------------------------------------
// KPI teknisi
// ---------------------------------------------------------------------------

export type TechnicianKpi = {
  /** Target bulanan dari `branches.intensif_target_count`. */
  target: number | null;
  /** Servis selesai bulan berjalan. */
  selesai: number;
  /** Persentase 0-100, atau null kalau target belum diatur. */
  targetPct: number | null;
  /**
   * true = cabang tidak punya target aktif, kartu menampilkan empty state.
   *
   * Bedakan dari `applicable`: "belum diatur" masihCallable diperbaiki, kalau
   * "tidak berlaku" memang tidak ada yang bisa diatur.
   */
  unset: boolean;
  /**
   * false = cabang tidak memakai mode flat, jadi target tidak berlaku.
   *
   * Target adalah syarat pembayaran khusus mode flat. Pada mode percent/fixed
   * tidak ada target sama sekali, dan menampilkan ajakan "Atur sekarang" di
   * sana hanya mengarahkan teknisi ke halaman yang tidak bisa ia buka.
   */
  applicable: boolean;
  /** Servis berstatus `Masuk` yang dibuat hari ini. */
  masukHariIni: number;
  /**
   * Servis yang selesai hari ini.
   *
   * Dihitung dari `completed_at`, bukan `created_at` maupun `updated_at`:
   * servis bisa dibuat minggu lalu dan baru diselesaikan hari ini, dan
   * `set_service_status` tidak pernah menyentuh `updated_at`.
   */
  selesaiHariIni: number;
};

const DONE_STATUS = new Set(["Selesai", "Sudah Diambil"]);

export function buildTechnicianKpi(
  services: TechnicianServiceInput[],
  teknisiId: string | null,
  branchIntensif: BranchIntensif | null,
  now: Date,
): TechnicianKpi {
  const selesai = teknisiId
    ? services.filter((s) => s.teknisi_id === teknisiId && DONE_STATUS.has(s.status) && dalamRentangBulan(s.completed_at, now)).length
    : 0;

  const rawTarget = branchIntensif?.intensif_target_count ?? null;
  const active = branchIntensif?.is_intensif_enabled === true;
  // Target adalah syarat pembayaran mode flat. Di mode lain `intensif_mode`
  // bukan "flat", jadi nilai target yang tersimpan (jika ada) tidak dipakai
  // sebagai KPI -- dan UI tidak boleh menawarkan pengaturan yang tidak ada.
  const applicable = branchIntensif?.intensif_mode === "flat";
  const target = active && applicable && rawTarget && rawTarget > 0 ? rawTarget : null;

  // Tanpa assignment tidak ada yang bisa dihitung - teknisi tidak melihat
  // antrean orang lain, jadi jangan dijumlahkan diam-diam.
  const masukHariIni = teknisiId
    ? services.filter(
        (s) => s.teknisi_id === teknisiId && s.status === "Masuk" && dalamHariYangSama(s.created_at, now),
      ).length
    : 0;

  const selesaiHariIni = teknisiId
    ? services.filter((s) => s.teknisi_id === teknisiId && DONE_STATUS.has(s.status) && dalamHariYangSama(s.completed_at, now)).length
    : 0;

  return {
    target,
    selesai,
    targetPct: target ? Math.min(100, Math.round((selesai / target) * 100)) : null,
    unset: target === null,
    applicable,
    masukHariIni,
    selesaiHariIni,
  };
}

// ---------------------------------------------------------------------------
// Servis terbaru
// ---------------------------------------------------------------------------

/** Satu baris untuk kartu "Servis terbaru" di dashboard. */
export type RecentService = {
  id: string;
  serviceNumber: string | null;
  device: string;
};

/** Baris servis yang dibuang dari kartu "Servis terbaru". */
const HIDDEN_STATUS = new Set(["Batal"]);

/**
 * Servis terbaru milik teknisi tertentu, terbaru lebih dulu.
 *
 * Kartu ini jadi pintu masuk ke detail servis, jadi servis yang dibatalkan
 * tidak layak ditampilkan - membuka halaman untuk servis batal hanya
 * membingungkan. `limit` dipakai supaya payload tidak ikut membesar.
 */
export function buildRecentServices(
  services: TechnicianServiceInput[],
  teknisiId: string | null,
  now: Date,
  limit = 6,
): RecentService[] {
  if (!teknisiId) return [];
  return services
    .filter((s) => s.teknisi_id === teknisiId && !HIDDEN_STATUS.has(s.status))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, limit)
    .map((s) => ({
      id: s.id,
      serviceNumber: s.service_number,
      device: s.device ?? "Tanpa perangkat",
    }));
}

// ---------------------------------------------------------------------------
// Label tenggat To-Do
// ---------------------------------------------------------------------------

export type DueLabel = "Hari ini" | "Besok" | "Lewat" | string;

/**
 * Label tenggat relatif untuk baris To-Do. Mengembalikan `null` kalau tidak
 * ada tenggat; string tanggal kalender kalau sudah jauh ke belakang.
 */
export function bucketDueLabel(dueAt: string | null, now: Date): DueLabel | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;

  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startOfDue = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const days = Math.round((startOfDue - startOfToday) / 86_400_000);

  if (days < 0) return "Lewat";
  if (days === 0) return "Hari ini";
  if (days === 1) return "Besok";
  return due.toISOString().slice(0, 10);
}
