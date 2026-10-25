"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { normalizeAppRole } from "@/lib/nav/manifest";
import {
  computeShiftReport,
  loadCashSession,
  loadFrontlinerKpi,
  loadFrontlinerQueue,
  loadTechnicianHome,
  loadTodoMentions,
  loadTodos,
  type HomeContext,
} from "@/lib/home/home-data";
import type {
  FrontlinerHomeData,
  HomeData,
  TechnicianDashboardData,
  TechnicianHomeData,
} from "@/lib/home/types";
import type { ShiftReport } from "@/lib/operational/laporan-shift";
import type { FrontlinerKpi } from "@/lib/operational/frontliner-dashboard";
import type { TodoMention } from "./todo-mentions";
import type { StaffTodo } from "./todos";

/**
 * Satu pintu data untuk Home staf (`/app` untuk teknisi dan frontliner).
 *
 * Kenapa ada: dashboard dulu merakit dirinya sendiri dari komponen klien lewat
 * beberapa server action di `useEffect`. Itu berarti browser harus menunggu
 * halaman ter-hydrate dulu sebelum meminta datanya, dan setiap action
 * me-resolve aktor dari awal (auth + employees + profiles + organizations +
 * branches + subscriptions). Frontliner memicu delapan resolusi per sekali
 * buka Home.
 *
 * Di sini aktor di-resolve sekali, semua query berjalan paralel, dan hasilnya
 * dikirim sebagai prop dari Server Component. Aksi per-aksi tetap dipakai untuk
 * menyegarkan setelah pengguna melakukan sesuatu — mereka tidak lagi menentukan
 * paint pertama.
 */
export async function getHomeData(): Promise<HomeData> {
  const actor = await getActiveTenant();
  const ctx: HomeContext = {
    supabase: actor.supabase,
    branchId: actor.branchId ?? "",
    userId: actor.userId,
    role: actor.role,
  };

  const isFrontliner = normalizeAppRole(actor.role) === "FRONTLINER";

  // To-Do hanya butuh identitas, bukan cabang, jadi mulai bersamaan dengan
  // data dashboard. Kalau assignment cabang akun ini rusak, To-Do tetap tampil.
  const todosPromise = settle(() => loadTodos(ctx), [] as StaffTodo[]);
  const homePromise = actor.branchId
    ? isFrontliner
      ? loadFrontlinerHome(ctx)
      : loadTechnicianHomeData(ctx)
    : null;

  const todos = await todosPromise;
  const mentions = todos.value.length
    ? await settle(
        () => loadTodoMentions(ctx, todos.value.map((todo) => todo.id)),
        [] as TodoMention[],
      )
    : { value: [] as TodoMention[], error: null };

  const base = { todos: todos.value, mentions: mentions.value };
  const sharedError = todos.error ?? mentions.error;

  if (!homePromise) {
    const error = sharedError ?? "Cabang belum ditetapkan untuk akun ini";
    if (isFrontliner) {
      return {
        kind: "frontliner",
        ...base,
        queue: [],
        kpi: null,
        session: null,
        report: null,
        error,
      };
    }
    return { kind: "technician", ...base, dashboard: EMPTY_TECHNICIAN, error };
  }

  const home = await homePromise;
  return { ...home, ...base, error: sharedError ?? home.error };
}

/** Bagian dashboard frontliner, tanpa To-Do. */
async function loadFrontlinerHome(
  ctx: HomeContext,
): Promise<Omit<FrontlinerHomeData, "todos" | "mentions">> {
  const [queue, kpi, cash] = await Promise.all([
    settle(() => loadFrontlinerQueue(ctx), []),
    settle<FrontlinerKpi | null>(() => loadFrontlinerKpi(ctx), null),
    settle(() => loadCashSession(ctx), { current: null, stale: null }),
  ]);

  const current = cash.value.current;
  const report = current
    ? await settle<ShiftReport | null>(() => computeShiftReport(ctx, current), null)
    : { value: null, error: null };

  return {
    kind: "frontliner",
    queue: queue.value,
    kpi: kpi.value,
    session: current,
    report: report.value,
    error: queue.error ?? kpi.error ?? cash.error ?? report.error,
  };
}

/** Bagian dashboard teknisi, tanpa To-Do. */
async function loadTechnicianHomeData(
  ctx: HomeContext,
): Promise<Omit<TechnicianHomeData, "todos" | "mentions">> {
  const dashboard = await settle(() => loadTechnicianHome(ctx), EMPTY_TECHNICIAN);
  return { kind: "technician", dashboard: dashboard.value, error: dashboard.error };
}

/**
 * Menjalankan satu pemuatan tanpa menggagalkan seluruh dashboard.
 *
 * Home menampilkan empat kelompok data yang tidak saling bergantung; satu
 * query yang gagal tidak boleh mengosongkan tiga yang lain.
 */
async function settle<T>(
  run: () => Promise<T>,
  fallback: T,
): Promise<{ value: T; error: string | null }> {
  try {
    return { value: await run(), error: null };
  } catch (cause) {
    return {
      value: fallback,
      error: cause instanceof Error ? cause.message : "Gagal memuat data dashboard",
    };
  }
}

const EMPTY_TECHNICIAN: TechnicianDashboardData = {
  attention: [],
  // `applicable: false` supaya kartu Target jatuh ke empty state "tidak ada
  // target bulanan", bukan "belum diatur" -- yang menyiratkan ada sesuatu yang
  // bisa dikonfigurasi.
  kpi: {
    target: null,
    selesai: 0,
    targetPct: null,
    unset: true,
    applicable: false,
    masukHariIni: 0,
    selesaiHariIni: 0,
  },
  terbaru: [],
};
