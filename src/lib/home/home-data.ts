import {
  awalHariWIB,
  kalenderWIB,
  rentangBulanSekarang,
} from "@/lib/operational/periode-bulan";
import {
  buildAttentionQueue,
  buildRecentServices,
  buildTechnicianKpi,
  type BranchIntensif,
  type TechnicianServiceInput,
} from "@/lib/operational/technician-dashboard";
import {
  buildFrontlinerKpiFromCounts,
  FRONTLINER_IN_PROGRESS_STATUSES,
  type FrontlinerKpi,
} from "@/lib/operational/frontliner-dashboard";
import {
  buildLaporanShift,
  shiftDateWindow,
  type ShiftCashRow,
  type ShiftReport,
  type ShiftSaleRow,
  type ShiftServiceRow,
  type ShiftSession,
} from "@/lib/operational/laporan-shift";
import type { Actor } from "@/lib/supabase/actor";
import { sanitizeSearchTerm } from "@/lib/search-term";
import type { StaffTodo } from "@/app/app/actions/todos";
import type { TodoMention } from "@/app/app/actions/todo-mentions";
import type { FrontlinerQueueItem, PickupServiceItem, TechnicianDashboardData } from "./types";

/**
 * Pengambilan data dashboard `/app`.
 *
 * Semua fungsi di sini menerima konteks aktor yang SUDAH di-resolve. Itu
 * sengaja: `getActiveTenant()` membaca auth + employees + profiles +
 * organizations + branches + subscriptions, dan versi lama memanggilnya sekali
 * per aksi (frontliner: delapan kali per sekali buka Home). Satu konteks untuk
 * semua query membuat biaya itu dibayar sekali, bukan delapan kali.
 *
 * Fungsi di file ini boleh melempar error; pemanggil yang memutuskan apakah
 * error itu ditampilkan atau diganti data kosong.
 */

export type HomeContext = {
  supabase: Actor["supabase"];
  branchId: string;
  userId: string;
  role: string;
};

/** Batas baris antrean kasir. Antrean panjang tidak boleh memperlambat Home. */
const QUEUE_ROW_LIMIT = 200;

// Laporan shift adalah rekap satu hari kerja, bukan ekspor.
const SERVICE_ROW_CAP = 500;
const SALE_ROW_CAP = 500;
const CASH_ROW_CAP = 500;
// Satu shift normal memakai jauh lebih sedikit dari ini; batas ini hanya
// menjaga query tetap terbatas kalau ada data aneh.
const SPAREPART_ROW_CAP = 500;

/** Berapa baris yang dikirim ke kartu "Servis terbaru". */
const TERBARU_LIMIT = 6;

/**
 * Kolom servis yang dipakai perhitungan dashboard teknisi.
 *
 * Satu daftar untuk ketiga query supaya bentuk barisnya identik dan bisa
 * diteruskan ke fungsi murni di `@/lib/operational/technician-dashboard`.
 */
const TECHNICIAN_SERVICE_COLUMNS =
  "id, service_number, created_at, updated_at, completed_at, branch_id, teknisi_id, status, price, device";

/** Status yang masih mungkin menggantung di meja teknisi. */
const ATTENTION_STATUSES = ["Masuk", "Dikerjakan", "Selesai"];

// ---------------------------------------------------------------------------
// Dashboard teknisi
// ---------------------------------------------------------------------------

/**
 * Data dashboard teknisi.
 *
 * Versi lama mengambil sampai 2000 baris SATU CABANG lalu menyaring
 * `teknisi_id` di JavaScript untuk menghitung tiga angka dan enam baris daftar.
 * Sekarang setiap query sudah dibatasi ke teknisi yang sedang login, dan hanya
 * memuat baris yang memang dipakai:
 *
 * - antrean: servis aktif miliknya (biasanya belasan baris),
 * - KPI: servis yang dibuat bulan ini + yang selesai bulan ini (dibuat bulan
 *   lalu tapi selesai sekarang tetap terhitung),
 * - "Servis terbaru": enam baris terakhir, bukan seluruh riwayat.
 *
 * Ketiganya berjalan paralel, jadi jumlah query bertambah tapi waktunya tidak.
 */
export async function loadTechnicianHome(ctx: HomeContext): Promise<TechnicianDashboardData> {
  const { supabase, branchId, userId } = ctx;
  const now = new Date();
  const monthStart = rentangBulanSekarang(now).from.toISOString();

  const [attentionResult, createdResult, completedResult, recentResult, branchResult] =
    await Promise.all([
      supabase
        .from("cervise_services")
        .select(TECHNICIAN_SERVICE_COLUMNS)
        .eq("branch_id", branchId)
        .eq("teknisi_id", userId)
        .in("status", ATTENTION_STATUSES)
        .order("updated_at", { ascending: true }),
      supabase
        .from("cervise_services")
        .select(TECHNICIAN_SERVICE_COLUMNS)
        .eq("branch_id", branchId)
        .eq("teknisi_id", userId)
        .gte("created_at", monthStart),
      supabase
        .from("cervise_services")
        .select(TECHNICIAN_SERVICE_COLUMNS)
        .eq("branch_id", branchId)
        .eq("teknisi_id", userId)
        .gte("completed_at", monthStart)
        // Yang dibuat bulan ini sudah ikut query di atas; jangan dihitung dua
        // kali saat barisnya digabung.
        .lt("created_at", monthStart),
      supabase
        .from("cervise_services")
        .select(TECHNICIAN_SERVICE_COLUMNS)
        .eq("branch_id", branchId)
        .eq("teknisi_id", userId)
        .neq("status", "Batal")
        .order("updated_at", { ascending: false })
        .limit(TERBARU_LIMIT),
      supabase
        .from("branches")
        .select("is_intensif_enabled, intensif_mode, intensif_value, intensif_target_count")
        .eq("id", branchId)
        .maybeSingle(),
    ]);

  for (const result of [attentionResult, createdResult, completedResult, recentResult, branchResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const attentionRows = (attentionResult.data ?? []) as TechnicianServiceInput[];
  const recentRows = (recentResult.data ?? []) as TechnicianServiceInput[];
  const kpiRows = [
    ...((createdResult.data ?? []) as TechnicianServiceInput[]),
    ...((completedResult.data ?? []) as TechnicianServiceInput[]),
  ];
  const branch = (branchResult.data ?? null) as BranchIntensif | null;

  return {
    attention: buildAttentionQueue(attentionRows, userId, now),
    kpi: buildTechnicianKpi(kpiRows, userId, branch, now),
    terbaru: buildRecentServices(recentRows, userId, now, TERBARU_LIMIT),
  };
}

// ---------------------------------------------------------------------------
// Dashboard frontliner
// ---------------------------------------------------------------------------

type QueueServiceRow = {
  id: string;
  service_number: string | null;
  device: string | null;
  status: string;
  price: number | null;
  price_estimasi: number | null;
  created_at: string;
  customer_id: string | null;
};

/**
 * Servis yang belum punya penjualan terkait — antrean "Bayar".
 *
 * Perubahan dari versi lama ada di query kedua: dulu ia mengambil SELURUH
 * penjualan cabang yang `servis_id`-nya tidak null, tanpa batas, hanya untuk
 * membentuk himpunan id yang sudah dibayar. Sekarang yang diminta hanya id
 * milik baris yang benar-benar diambil di langkah pertama.
 */
export async function loadFrontlinerQueue(ctx: HomeContext): Promise<FrontlinerQueueItem[]> {
  const { supabase, branchId } = ctx;

  const { data, error } = await supabase
    .from("cervise_services")
    .select("id, service_number, device, status, price, price_estimasi, created_at, customer_id")
    .eq("branch_id", branchId)
    .not("status", "in", '("Batal")')
    .order("created_at", { ascending: false })
    .limit(QUEUE_ROW_LIMIT);
  if (error) throw new Error(error.message);

  const services = (data ?? []) as QueueServiceRow[];
  const customerIds = [
    ...new Set(services.map((service) => service.customer_id).filter(Boolean)),
  ] as string[];

  const [paidIds, customerName] = await Promise.all([
    loadPaidServiceIds(supabase, branchId, services.map((service) => service.id)),
    loadCustomerNames(supabase, customerIds),
  ]);

  return services
    .filter((service) => !paidIds.has(service.id))
    .map((service) => ({
      id: service.id,
      serviceNumber: service.service_number,
      device: service.device ?? "Tanpa perangkat",
      status: service.status,
      // `price` adalah total yang SUDAH dibayar, jadi untuk servis di antrean
      // nilainya 0. Yang perlu ditagih adalah estimasinya.
      price: service.price_estimasi ?? service.price ?? 0,
      createdAt: service.created_at,
      customerName: service.customer_id
        ? (customerName.get(service.customer_id) ?? null)
        : null,
    }));
}

async function loadPaidServiceIds(
  supabase: Actor["supabase"],
  branchId: string,
  serviceIds: string[],
): Promise<Set<string>> {
  if (serviceIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("cervise_sales")
    .select("servis_id")
    .eq("branch_id", branchId)
    .in("servis_id", serviceIds);
  if (error) throw new Error(error.message);
  return new Set(
    (data ?? []).map((row) => row.servis_id as string | null).filter((id): id is string => Boolean(id)),
  );
}

async function loadCustomerNames(
  supabase: Actor["supabase"],
  customerIds: string[],
): Promise<Map<string, string>> {
  if (customerIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("cervise_customers")
    .select("id, name")
    .in("id", customerIds);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((row) => [row.id as string, row.name as string]));
}

/** Batas hasil pencarian pengambilan device; panelnya kecil, bukan halaman. */
const PICKUP_LIMIT = 10;

/**
 * Cari servis berstatus `Selesai` (siap diambil) berdasarkan nomor servis,
 * perangkat, nama customer, atau nomor HP.
 *
 * Dua langkah karena PostgREST tidak bisa memfilter kolom tabel relasi yang
 * tidak ikut di-select: customer dicari dulu, id-nya dipakai untuk memfilter
 * servis. Pola yang sama dipakai daftar servis.
 */
export async function searchPickupServices(
  ctx: HomeContext,
  rawQuery: string,
): Promise<PickupServiceItem[]> {
  const { supabase, branchId } = ctx;
  const term = sanitizeSearchTerm(rawQuery);
  if (term.length < 2) return [];

  const { data: customers, error: customerError } = await supabase
    .from("cervise_customers")
    .select("id")
    .eq("branch_id", branchId)
    .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
    .limit(PICKUP_LIMIT);
  if (customerError) throw new Error(customerError.message);

  const customerIds = (customers ?? []).map((row) => row.id as string);
  const filters = [`service_number.ilike.%${term}%`, `device.ilike.%${term}%`];
  if (customerIds.length > 0) filters.push(`customer_id.in.(${customerIds.join(",")})`);

  const { data, error } = await supabase
    .from("cervise_services")
    .select("id, service_number, device, customer_id, updated_at")
    .eq("branch_id", branchId)
    .eq("status", "Selesai")
    .or(filters.join(","))
    .order("updated_at", { ascending: false })
    .limit(PICKUP_LIMIT);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const resultCustomerIds = [
    ...new Set(rows.map((row) => row.customer_id).filter(Boolean)),
  ] as string[];

  const contact = new Map<string, { name: string; phone: string }>();
  if (resultCustomerIds.length > 0) {
    const { data: contacts, error: contactError } = await supabase
      .from("cervise_customers")
      .select("id, name, phone")
      .in("id", resultCustomerIds);
    if (contactError) throw new Error(contactError.message);
    for (const row of contacts ?? []) {
      contact.set(row.id as string, {
        name: String(row.name ?? ""),
        phone: String(row.phone ?? ""),
      });
    }
  }

  return rows.map((row) => {
    const customer = row.customer_id ? contact.get(row.customer_id as string) : undefined;
    return {
      id: row.id as string,
      serviceNumber: (row.service_number as string | null) ?? null,
      device: (row.device as string | null) ?? "Tanpa perangkat",
      customerName: customer?.name ?? null,
      customerPhone: customer?.phone ?? null,
      updatedAt: row.updated_at as string,
    };
  });
}

/**
 * Empat angka "Ringkasan Servis" hari ini.
 *
 * Dulu 500 baris diambil lalu dihitung di JavaScript. Sekarang yang diminta ke
 * database hanya jumlahnya (`head: true` + `count: "exact"`), dan keempat
 * hitungan berjalan paralel.
 *
 * `proses` sengaja mencakup `Masuk` juga — itu perilaku yang sudah ada dan
 * yang dibaca kartu "Ringkasan Servis".
 */
export async function loadFrontlinerKpi(ctx: HomeContext): Promise<FrontlinerKpi> {
  const { supabase, branchId } = ctx;
  const since = awalHariWIB(new Date()).toISOString();

  const countToday = () =>
    supabase
      .from("cervise_services")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .gte("created_at", since);

  const [masuk, selesai, diambil, proses] = await Promise.all([
    countToday().eq("status", "Masuk"),
    countToday().eq("status", "Selesai"),
    countToday().eq("status", "Sudah Diambil"),
    countToday().in("status", [...FRONTLINER_IN_PROGRESS_STATUSES]),
  ]);

  for (const result of [masuk, selesai, diambil, proses]) {
    if (result.error) throw new Error(result.error.message);
  }

  return buildFrontlinerKpiFromCounts({
    masuk: masuk.count ?? 0,
    selesai: selesai.count ?? 0,
    diambil: diambil.count ?? 0,
    proses: proses.count ?? 0,
  });
}

// ---------------------------------------------------------------------------
// Sesi kas & laporan shift
// ---------------------------------------------------------------------------

/** Baris `cervise_cash_sessions` sebelum digabung dengan nama cabang/pegawai. */
export type CashSessionRecord = {
  id: string;
  branch_id: string;
  employee_id: string;
  open_at: string;
  opening_balance: number;
  closed_at: string | null;
  closing_balance?: number | null;
  variance?: number | null;
};

/** Melengkapi baris sesi dengan nama cabang dan nama pegawai. */
export async function hydrateSessions(
  supabase: Actor["supabase"],
  rows: CashSessionRecord[],
): Promise<ShiftSession[]> {
  if (rows.length === 0) return [];

  const branchIds = [...new Set(rows.map((row) => row.branch_id))];
  const profileIds = [...new Set(rows.map((row) => row.employee_id))];

  const [branches, profiles] = await Promise.all([
    supabase.from("branches").select("id, name").in("id", branchIds),
    supabase.from("profiles").select("id, full_name").in("id", profileIds),
  ]);

  const branchName = new Map((branches.data ?? []).map((b) => [b.id as string, b.name as string]));
  const employeeName = new Map(
    (profiles.data ?? []).map((p) => [p.id as string, (p.full_name as string) ?? "Tanpa nama"]),
  );

  return rows.map((row) => ({
    id: row.id,
    branchId: row.branch_id,
    employeeId: row.employee_id,
    openAt: row.open_at,
    openingBalance: row.opening_balance,
    closedAt: row.closed_at,
    closingBalance: row.closing_balance ?? null,
    variance: row.variance ?? null,
    branchName: branchName.get(row.branch_id) ?? "—",
    employeeName: employeeName.get(row.employee_id) ?? "—",
  }));
}

/**
 * Sesi kas terbuka milik pengguna ini, atau null.
 *
 * `staleSession` mengembalikan sesi terbuka yang tanggalnya sudah lewat — tahu
 * kalau ada shift yang ditinggalkan tanpa ditutup, supaya dialog saldo awal
 * bisa memperingatkan sebelum membuat sesi baru.
 */
export async function loadCashSession(
  ctx: HomeContext,
): Promise<{ current: ShiftSession | null; stale: ShiftSession | null }> {
  const { supabase, userId } = ctx;

  const { data, error } = await supabase
    .from("cervise_cash_sessions")
    .select("id, branch_id, employee_id, open_at, opening_balance, closed_at, closing_balance, variance")
    .eq("employee_id", userId)
    .is("closed_at", null)
    .order("open_at", { ascending: false });
  if (error) throw new Error(error.message);

  const today = kalenderWIB(new Date());
  const hydrated = await hydrateSessions(supabase, (data ?? []) as CashSessionRecord[]);

  return {
    // Index unik `where closed_at is null` menjamin paling banyak satu, tapi
    // `find` tetap dipakai supaya tidak bergantung pada itu.
    current:
      hydrated.find((row) => kalenderWIB(new Date(row.openAt)) === today) ?? hydrated[0] ?? null,
    stale: hydrated.find((row) => kalenderWIB(new Date(row.openAt)) !== today) ?? null,
  };
}

/** Satu sesi berdasarkan id, belum digabung dengan nama. */
export async function loadCashSessionRecord(
  ctx: HomeContext,
  sessionId: string,
): Promise<CashSessionRecord> {
  const { supabase } = ctx;
  const { data, error } = await supabase
    .from("cervise_cash_sessions")
    .select("id, branch_id, employee_id, open_at, opening_balance, closed_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sesi kas tidak ditemukan");
  return data as CashSessionRecord;
}

/**
 * Laporan shift dari sesi yang SUDAH dihidrasi.
 *
 * Menerima konteks aktor, bukan me-resolve ulang: dulu rantai
 * `getShiftPreview -> computeReport -> hydrateSessions` memanggil
 * `getActiveTenant()` tiga kali untuk satu dialog.
 */
export async function computeShiftReport(
  ctx: HomeContext,
  session: ShiftSession,
): Promise<ShiftReport> {
  const { supabase, branchId } = ctx;
  const now = new Date();
  // Satu shift bisa mencakup lebih dari satu tanggal: shift kemarin yang masih
  // terbuka sampai hari ini harus memuat penjualan dan kas manual hari ini.
  // Memakai tanggal buka saja membuat uang hari ini hilang dari rekap sementara
  // servisnya tetap masuk (servis memakai `created_at` yang jamnya tersimpan).
  const { from: openDate, to: closeDate } = shiftDateWindow(session, now);

  // Tiga query paralel. Setiap filter mengikuti bentuk kolomnya masing-masing:
  // servis pakai created_at (timestamptz, jamnya ada), penjualan dan kas pakai
  // kas_date (date, jamnya hilang) jadi satu rentang tanggal shift.
  const [servicesResult, salesResult, cashResult] = await Promise.all([
    supabase
      .from("cervise_services")
      .select("id, service_number, device, status, price, created_at, updated_at")
      .eq("branch_id", branchId)
      .gte("created_at", session.openAt)
      .order("created_at", { ascending: false })
      .limit(SERVICE_ROW_CAP),
    supabase
      .from("cervise_sales")
      .select("id, sale_number, total, paid, payment_status, payment_method, kas_date, servis_id")
      .eq("branch_id", branchId)
      .gte("kas_date", openDate)
      .lte("kas_date", closeDate)
      .order("created_at", { ascending: false })
      .limit(SALE_ROW_CAP),
    supabase
      .from("cervise_finance_tx")
      .select("id, type, amount, description, kas_date, source, metode")
      .eq("branch_id", branchId)
      .gte("kas_date", openDate)
      .lte("kas_date", closeDate)
      .in("source", ["kas_manual", "penyesuaian", "retur"])
      .order("created_at", { ascending: false })
      .limit(CASH_ROW_CAP),
  ]);

  if (servicesResult.error) throw new Error(servicesResult.error.message);
  if (salesResult.error) throw new Error(salesResult.error.message);
  if (cashResult.error) throw new Error(cashResult.error.message);

  // Sparepart dipotong dengan jendela jam yang sama seperti servis: baris
  // sparepart dibuat saat teknisi memakainya, jadi created_at-nya setara.
  // Baris yang sudah dikembalikan tidak dihitung sebagai pemakaian.
  const closeAt = session.closedAt ?? now.toISOString();
  const sparepartsResult = await supabase
    .from("cervise_service_spareparts")
    .select("name, qty")
    .eq("branch_id", branchId)
    .eq("is_returned", false)
    .gte("created_at", session.openAt)
    .lt("created_at", closeAt)
    .limit(SPAREPART_ROW_CAP);

  if (sparepartsResult.error) throw new Error(sparepartsResult.error.message);

  const sparepartQty = new Map<string, number>();
  for (const row of sparepartsResult.data ?? []) {
    const name = String(row.name ?? "").trim();
    if (!name) continue;
    sparepartQty.set(name, (sparepartQty.get(name) ?? 0) + Number(row.qty ?? 0));
  }

  return buildLaporanShift({
    session,
    services: (servicesResult.data ?? []) as ShiftServiceRow[],
    sales: (salesResult.data ?? []) as ShiftSaleRow[],
    cashTx: (cashResult.data ?? []) as ShiftCashRow[],
    spareparts: [...sparepartQty.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    now,
  });
}

// ---------------------------------------------------------------------------
// To-Do pribadi
// ---------------------------------------------------------------------------
export type TodoRow = {
  id: string;
  title: string;
  due_at: string | null;
  done_at: string | null;
  created_at: string;
};

export function toTodo(row: TodoRow): StaffTodo {
  return {
    id: row.id,
    title: row.title,
    dueAt: row.due_at,
    doneAt: row.done_at,
    createdAt: row.created_at,
  };
}

/**
 * Tugas selesai yang sudah lewat hari kalender WIB.
 *
 * To-Do adalah daftar kerja hari ini, bukan arsip. Yang dicentang kemarin
 * tidak boleh terus menahan hitungan `2/9` besoknya — sisanya yang belum
 * selesai harus tampil sebagai `0/7`. Tugas selesai HARI INI tetap ikut supaya
 * salah centang masih bisa dibatalkan.
 */
export function todoSelesaiSebelumHariIni(
  doneAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!doneAt) return false;
  const waktu = new Date(doneAt);
  // Timestamp rusak (mis. `"pending"` saat pembaruan optimistik) jangan
  // dihapus diam-diam; lebih baik tampil sebentar daripada hilang tanpa jejak.
  if (Number.isNaN(waktu.getTime())) return false;
  return waktu.getTime() < awalHariWIB(now).getTime();
}

/**
 * Baris To-Do milik pengguna ini saja.
 *
 * Selesai hari ini tetap ikut agar bisa dibatalkan; selesai sebelum hari ini
 * dibersihkan saat dimuat. Penghapusan dilakukan di sini, bukan cron, supaya
 * tidak butuh jadwal tambahan dan tugas lama hilang tepat saat pemiliknya
 * membuka To-Do lagi.
 */
export async function loadTodos(ctx: HomeContext): Promise<StaffTodo[]> {
  const { supabase, userId } = ctx;
  const { data, error } = await supabase
    .from("cervise_staff_todos")
    .select("id, title, due_at, done_at, created_at")
    .eq("employee_id", userId)
    .order("done_at", { ascending: true, nullsFirst: false })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as TodoRow[];
  const now = new Date();
  const kedaluwarsa = rows.filter((row) => todoSelesaiSebelumHariIni(row.done_at, now));

  if (kedaluwarsa.length > 0) {
    const { error: bersihkanError } = await supabase
      .from("cervise_staff_todos")
      .delete()
      .eq("employee_id", userId)
      .in(
        "id",
        kedaluwarsa.map((row) => row.id),
      );
    // Kebersihan bukan alasan To-Do gagal tampil. Kalau hapus gagal, baris
    // lama tetap disaring dari hasil, jadi kartu besoknya sudah bersih dan
    // penghapusan dicoba lagi pada pemuatan berikutnya.
    if (bersihkanError) {
      console.warn("[todos] gagal membersihkan tugas selesai:", bersihkanError.message);
    }
  }

  const kedaluwarsaIds = new Set(kedaluwarsa.map((row) => row.id));
  return rows.filter((row) => !kedaluwarsaIds.has(row.id)).map(toTodo);
}

type MentionRow = {
  id: string;
  token: string;
  todo_id: string;
  customer_id: string | null;
  servis_id: string | null;
  customer: { id: string; name: string; phone: string } | null;
  servis: { id: string; service_number: string | null; device: string | null } | null;
};

function flattenMention(row: unknown): TodoMention[] {
  const r = row as MentionRow;

  // Label hilang berarti target-nya sudah dihapus (on delete set null).
  // Baris seperti ini tidak ditampilkan: chip tanpa tujuan yang bisa dibuka
  // hanya menambah noise di catatan.
  if (r.customer_id && r.customer) {
    return [
      {
        mentionId: r.id,
        token: r.token,
        todoId: r.todo_id,
        kind: "customer" as const,
        id: r.customer_id,
        label: r.customer.name,
        sub: r.customer.phone,
      },
    ];
  }
  if (r.servis_id && r.servis) {
    return [
      {
        mentionId: r.id,
        token: r.token,
        todoId: r.todo_id,
        kind: "servis" as const,
        id: r.servis_id,
        label: r.servis.service_number ?? "Servis",
        sub: r.servis.device,
      },
    ];
  }
  return [];
}

/**
 * Mention milik sekumpulan catatan.
 *
 * `todo_id` ikut dikembalikan supaya client bisa mengelompokkan mention per
 * catatan tanpa kueri kedua.
 *
 * `in` dipisah ke kueri sendiri, bukan join `!inner`, supaya catatan tanpa
 * mention tetap ikut — `!inner` membuang catatan itu dari hasil.
 */
export async function loadTodoMentions(
  ctx: HomeContext,
  todoIds: string[],
): Promise<TodoMention[]> {
  if (todoIds.length === 0) return [];
  const { supabase } = ctx;
  const { data, error } = await supabase
    .from("cervise_todo_mentions")
    .select(
      "id, token, todo_id, customer_id, servis_id, customer:cervise_customers(id, name, phone), servis:cervise_services(id, service_number, device)",
    )
    .in("todo_id", todoIds);
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap(flattenMention);
}
