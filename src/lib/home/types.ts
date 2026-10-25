import type { AttentionItem, RecentService, TechnicianKpi } from "@/lib/operational/technician-dashboard";
import type { FrontlinerKpi } from "@/lib/operational/frontliner-dashboard";
import type { ShiftReport, ShiftSession } from "@/lib/operational/laporan-shift";
import type { StaffTodo } from "@/app/app/actions/todos";
import type { TodoMention } from "@/app/app/actions/todo-mentions";

/**
 * Bentuk data yang dibutuhkan dashboard `/app` untuk staf (teknisi & frontliner).
 *
 * Dulu semua angka diambil dari komponen klien lewat server action di
 * `useEffect`: satu round-trip browser -> server -> database sebelum satu angka
 * pun muncul. Sekarang data yang sama dirakit di server (`getHomeData`) dan
 * dikirim sebagai prop, jadi isinya sudah ada di HTML pertama. Aksi per-aksi
 * tetap ada untuk menyegarkan setelah pengguna melakukan sesuatu.
 */

/** Satu baris antrean "Bayar" di dashboard kasir. */
export type FrontlinerQueueItem = {
  id: string;
  serviceNumber: string | null;
  device: string;
  status: string;
  price: number;
  createdAt: string;
  customerName: string | null;
};

/**
 * Bentuk data dashboard teknisi.
 *
 * `attention` tidak dirender dashboard saat ini, tapi tetap dihitung: bentuk
 * ini dipakai juga oleh aksi penyegaran, dan menghapusnya berarti dua bentuk
 * berbeda untuk data yang sama.
 */
export type TechnicianDashboardData = {
  attention: AttentionItem[];
  kpi: TechnicianKpi;
  terbaru: RecentService[];
};

export type TechnicianHomeData = {
  kind: "technician";
  dashboard: TechnicianDashboardData;
  todos: StaffTodo[];
  mentions: TodoMention[];
  /** Pesan pertama yang gagal, atau null. Data yang gagal memakai nilai kosong. */
  error: string | null;
};

export type FrontlinerHomeData = {
  kind: "frontliner";
  queue: FrontlinerQueueItem[];
  kpi: FrontlinerKpi | null;
  session: ShiftSession | null;
  report: ShiftReport | null;
  todos: StaffTodo[];
  mentions: TodoMention[];
  /** Pesan pertama yang gagal, atau null. Data yang gagal memakai nilai kosong. */
  error: string | null;
};

export type HomeData = TechnicianHomeData | FrontlinerHomeData;
