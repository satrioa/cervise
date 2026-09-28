import { FonnteError, sendFonnteWA } from "@/lib/fonnte";
import { toFonnteTarget } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildCustomerCreatedMessage,
  buildCustomerStatusMessage,
  buildTechnicianCreatedMessage,
  type ServiceMessageInput,
} from "./service-message";

/**
 * Dispatcher notifikasi WhatsApp untuk servis.
 *
 * Klaim lewat RPC `claim_service_notifications`, bukan rantai query dari
 * aplikasi: `for update skip locked` memberi jaminan dua worker tidak
 * mengambil baris yang sama dalam satu statement, dan bentuk pemanggilannya
 * jadi satu fungsi yang mudah diuji.
 *
 * Dois hal yang dijaga modul ini dan mudah sekali hilang:
 *
 * 1. `attempts` dihitung DI SINI, bukan oleh claim. Claim hanya memasang lease
 *    2 menit di `next_attempt_at`. Kalau claim juga menaikkan `attempts`, satu
 *    percobaan terhitung dua kali dan MAX_ATTEMPTS = 4 hanya menghasilkan dua
 *    kiriman nyata. Konsekuensi lanjutannya: karena dispatcher yang menulis
 *    `attempts`, dispatcher WAJIB menyimpannya. Kalau tidak, kolomnya selalu 0,
 *    `row.attempts + 1` selalu 1, syarat `attempts >= 4` tidak pernah tercapai,
 *    dan satu pesan yang selalu gagal mencoba selamanya.
 *
 * 2. try/catch ada DI DALAM loop per baris. Klaim sudah menyewa seluruh baris
 *    yang dikembalikan, jadi satu baris yang melempar di luar loop memblokir
 *    semua baris di belakangnya -- semuanya menunggu lease penuh tanpa pernah
 *    dicoba.
 *
 * Server-only. Import modul ini dari route handler atau server action saja:
 * ia memakai service role, yang membypass seluruh RLS project.
 */

const MAX_ATTEMPTS = 4;
const BACKOFF_MINUTES = [1, 5, 30, 120];
const DEFAULT_LIMIT = 25;
const COUNTRY_CODE = "62";

export type DispatchResult = {
  sent: number;
  skipped: number;
  failed: number;
};

export type DispatchOptions = {
  limit?: number;
  now?: Date;
  siteOrigin?: string;
};

type OutboxRow = {
  id: string;
  servis_id: string | null;
  event: string;
  to_kind: string;
  to_status: string | null;
  attempts: number;
};

type ServisRow = {
  id: string;
  service_number: string | null;
  device: string;
  complaint: string | null;
  tracking_code: string | null;
  status: string | null;
  customer_id: string | null;
  teknisi_id: string | null;
  branches: {
    organization_id: string | null;
    organizations: { name: string; slug: string } | null;
  } | null;
};

type EmployeeRef = { organization_id: string; is_active: boolean };
type TechnicianRow = {
  id: string;
  phone: string | null;
  employees: EmployeeRef[] | null;
};
type CustomerRow = { id: string; phone: string | null };

/**
 * Hasil resolusi satu baris: pesan siap kirim, atau alasan terminal kenapa
 * tidak bisa dikirim.
 *
 * Semua di dalam `skip` bersifat TERMINAL. Alasannya seragam: baris outbox
 * mewakili satu peristiwa yang sudah lewat -- satu servis yang dibuat, satu
 * perubahan status. Menundanya tidak membuat peristiwa itu terjadi lagi, dan
 * tidak ada yang bisa memperbaiki CONDITIONS itu di luar intervensi manual.
 * Yang mencoba lagi hanya membakar anggaran percobaan, dan karena `attempts`
 * tidak pernah bertambah pada jalur ini, barisnya justru akan mencoba
 * selamanya. Itu kebalikan dari yang kita mau: kondisi yang sebenarnya bisa
 * diperbaiki admin (nomor diisi belakangan) berubah jadi kegagalan permanen
 * hanya karena antrean sempat bermasalah.
 */
type Resolved = { message: string; target: string } | { skip: string };

function backoffIso(attempts: number, from: Date): string {
  const index = Math.min(Math.max(attempts, 1) - 1, BACKOFF_MINUTES.length - 1);
  return new Date(from.getTime() + BACKOFF_MINUTES[index] * 60_000).toISOString();
}

/**
 * Fonnte membalas `{ detail: { id } }`. Bentuknya bisa berubah, jadi ID dibaca
 * secara defensif dan kegagalan membaca TIDAK membatalkan pengiriman: ID hanya
 * berguna untuk rekonsiliasi, sedangkan membatalkan kirim demi ID yang tidak
 * terbaca justru membuang notifikasi yang sudah sampai.
 */
function providerMessageIdOf(detail: unknown): string | null {
  const nested = (detail as { detail?: { id?: unknown } } | null)?.detail;
  const id = nested?.id;
  if (typeof id === "string" && id.trim() !== "") return id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return null;
}

/**
 * Nilai untuk kolom `last_error`.
 *
 * `FonnteError.reason` dipakai, bukan `Error.message`: message-nya berawalan
 * "Fonnte gagal: " sedangkan `reason` adalah nilai mentahnya -- "invalid target",
 * "HTTP 401" -- yang bisa dicari dan dibandingkan. Kolom ini dibaca operator saat
 * menelusuri antrean, jadi bentuk yang bisa dipetik lebih berharga daripada yang
 * enak dibaca.
 */
function errorText(error: unknown): string {
  if (error instanceof FonnteError) return error.reason;
  return error instanceof Error ? error.message : String(error);
}

/**
 * Menerjemahkan satu baris outbox menjadi pesan siap kirim, atau alasan terminal
 * kenapa dilewati. Nomor dan isi pesan sengaja dibaca DI SINI, bukan saat
 * enqueue, supaya perbaikan data oleh admin -- nomor diisi, teknisi diganti --
 * tetap terpakai.
 */
function resolveRow(
  row: OutboxRow,
  servis: ServisRow | undefined,
  customer: CustomerRow | undefined,
  technician: TechnicianRow | undefined,
  siteOrigin: string,
): Resolved {
  if (row.to_kind !== "customer" && row.to_kind !== "technician") {
    return { skip: "unsupported_recipient" };
  }

  // `servis_id` sengaja tidak punya foreign key supaya riwayat pengiriman
  // bertahan setelah servis dihapus. Konsekuensinya baris yatim itu keadaan
  // yang wajar, bukan-error: servis yang hilang tidak akan pernah kembali, dan
  // pesannya tidak bisa disusun tanpa data yang sudah tidak ada. Jadi terminal,
  // bukan dibiarkan menggantung.
  if (!servis) return { skip: "servis_not_found" };

  // Trigger hanya membuat baris teknisi untuk `servis_created`, dan tidak ada
  // builder status untuk teknisi. Kalau kombinasi ini diteruskan, teknisi
  // menerima "Servis baru masuk" untuk perubahan status.
  if (row.to_kind === "technician" && row.event !== "servis_created") {
    return { skip: "unsupported_technician_event" };
  }

  // `branches.organization_id` nullable, jadi `organizations` bisa null. Nama
  // toko TIDAK dikarang di sini: `heading()` di service-message.ts sudah
  // menangani nama kosong dengan menghapus pemisah " - "-nya, dan mengarang
  // nama akan mengarang fakta.
  const org = servis.branches?.organizations ?? null;
  const input: ServiceMessageInput = {
    storeName: org?.name ?? "",
    tenantSlug: org?.slug ?? null,
    serviceId: servis.id,
    serviceNumber: servis.service_number,
    device: servis.device,
    complaint: servis.complaint,
    trackingCode: servis.tracking_code,
    // `to_status` dibaca lebih dulu: itu status saat peristiwa diantrekan.
    // Servis bisa sudah lanjut ke tahap berikutnya sebelum pesannya benar-benar
    // terkirim, dan memberitahu pelanggan "Selesai" untuk servis yang sudah
    // diambil adalah informasi yang salah.
    status: row.to_status ?? servis.status,
    siteOrigin,
  };

  if (row.to_kind === "customer") {
    if (!customer) return { skip: "customer_not_found" };
    const target = toFonnteTarget(customer.phone);
    // Nomor yang tidak bisa jadi `62...` tidak akan pernah bisa dikirim, dan
    // tidak ada yang berubah antara sekarang dan percobaan berikutnya.
    if (!target) return { skip: "no_phone" };
    return {
      target,
      message:
        row.event === "servis_created"
          ? buildCustomerCreatedMessage(input)
          : buildCustomerStatusMessage(input),
    };
  }

  // Servis yang baru dibuat hampir selalu belum punya teknisi, jadi "belum ada
  // teknisi" adalah keadaan normal, bukan error.
  if (!technician) return { skip: "technician_not_found" };

  // Karyawan bisa punya baris employees di beberapa organisasi. Yang dicek hanya
  // `is_active` berarti teknisi yang sudah dinonaktifkan di tenant pemilik servis
  // ini tetap menerima detail servis tenant lain -- dan nomor teleponnya pun.
  // Karena itu baris employees-nya dibatasi ke organisasi cabangnya; kalau
  // cabangnya tidak punya organisasi, yang aktif di organisasi mana pun cukup.
  const branchOrganizationId = servis.branches?.organization_id ?? null;
  const activeCount = (technician.employees ?? []).filter((employee) => {
    if (!employee.is_active) return false;
    return branchOrganizationId === null || employee.organization_id === branchOrganizationId;
  }).length;
  if (activeCount === 0) return { skip: "technician_inactive" };

  const target = toFonnteTarget(technician.phone);
  if (!target) return { skip: "no_phone" };
  return { target, message: buildTechnicianCreatedMessage(input) };
}

export async function dispatchPendingNotifications(
  options: DispatchOptions = {},
): Promise<DispatchResult> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const now = options.now ?? new Date();
  const siteOrigin = options.siteOrigin ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const result: DispatchResult = { sent: 0, skipped: 0, failed: 0 };
  const admin = createAdminClient();

  // Klaim dalam satu statement. `skip locked` mencegah dua worker mengambil baris
  // yang sama, dan lease `next_attempt_at` 2 menit mencegah baris yang ditinggalkan
  // worker (crash sebelum patch) langsung diklaim ulang tanpa backoff. Tidak ada
  // jalur lepas: lease habis sendiri.
  const { data, error } = await admin.rpc("claim_service_notifications", { p_limit: limit });
  if (error) {
    // Melempar, bukan mengembalikan nol. Nol berarti "tidak ada yang perlu
    // dikerjakan" dan route akan menjawab 200 dengan antrean kosong, padahal
    // antreannya justru tidak terbaca. Barisnya masih pending dan akan diambil
    // lagi, jadi tidak ada yang hilang -- hanya kegagalannya jadi terlihat.
    throw new Error(`Klaim notifikasi gagal: ${error.message}`);
  }
  const rows = (data ?? []) as OutboxRow[];
  if (rows.length === 0) return result;

  // Pengambilan data di luar loop per baris, jadi satu kueri per tabel dan bukan
  // satu per baris.
  //
  // Error di sini sengaja dilempar, bukan diabaikan. Diabaikan, `servisById`
  // jadi kosong dan SETIAP baris salah didiagnosis `servis_not_found` lalu
  // ditandai failed permanen: satu kedipan jaringan membuang 25 notifikasi yang
  // sebenarnya masih layak. Baris yang tidak disentuh akan kembali di tick
  // berikutnya lewat lease-nya.
  const servisIds = [
    ...new Set(rows.map((row) => row.servis_id).filter((id): id is string => Boolean(id))),
  ];
  const servisById = new Map<string, ServisRow>();
  if (servisIds.length) {
    // Tanpa `!inner`: `branches.organization_id` nullable, dan `!inner` akan
    // membuang servis tanpa organisasi dari hasil sehingga barisnya salah
    // didiagnosis `servis_not_found`. Sama untuk `employees` -- teknisi tanpa
    // baris employees harus tetap muncul supaya bisa dibedakan "tidak ada
    // baris" dari "profil tidak ditemukan".
    const { data: servisRows, error: servisError } = await admin
      .from("cervise_services")
      .select(
        "id, service_number, device, complaint, tracking_code, status, customer_id, teknisi_id, branches(organization_id, organizations(name, slug))",
      )
      .in("id", servisIds);
    if (servisError) {
      throw new Error(`Pengambilan data servis gagal: ${servisError.message}`);
    }
    // `unknown` di tengah: tipe generik PostgREST menebak embed relasi
    // many-to-one sebagai array, sedangkan `branches` di sini benar-benar satu
    // objek. Tanpa langkah ini TypeScript menolak cast-nya, meski tidak ada
    // yang salah secara bentuk.
    for (const row of (servisRows ?? []) as unknown as ServisRow[]) servisById.set(row.id, row);
  }

  const neededCustomerIds = [
    ...new Set(
      rows
        .map((row) =>
          row.to_kind === "customer" ? servisById.get(row.servis_id ?? "")?.customer_id : null,
        )
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const customersById = new Map<string, CustomerRow>();
  if (neededCustomerIds.length) {
    const { data: customerRows, error: customerError } = await admin
      .from("cervise_customers")
      .select("id, phone")
      .in("id", neededCustomerIds);
    if (customerError) {
      throw new Error(`Pengambilan data pelanggan gagal: ${customerError.message}`);
    }
    for (const row of (customerRows ?? []) as CustomerRow[]) customersById.set(row.id, row);
  }

  const technicianIds = [
    ...new Set(
      rows
        .map((row) =>
          row.to_kind === "technician" ? servisById.get(row.servis_id ?? "")?.teknisi_id : null,
        )
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const techniciansById = new Map<string, TechnicianRow>();
  if (technicianIds.length) {
    const { data: techRows, error: techError } = await admin
      .from("profiles")
      .select("id, phone, employees(organization_id, is_active)")
      .in("id", technicianIds);
    if (techError) {
      throw new Error(`Pengambilan data teknisi gagal: ${techError.message}`);
    }
    for (const row of (techRows ?? []) as TechnicianRow[]) techniciansById.set(row.id, row);
  }

  for (const row of rows) {
    // Try/catch DI DALAM loop. Klaim sudah menyewa seluruh `rows`, jadi apa pun
    // yang melempar di luar loop membuat baris-baris berikutnya menunggu lease
    // penuh tanpa pernah dicoba -- satu baris beracun memblokir antrean.
    try {
      const servis = row.servis_id ? servisById.get(row.servis_id) : undefined;
      const customerId = row.to_kind === "customer" ? servis?.customer_id : null;
      const technicianId = row.to_kind === "technician" ? servis?.teknisi_id : null;

      const resolved = resolveRow(
        row,
        servis,
        customerId ? customersById.get(customerId) : undefined,
        technicianId ? techniciansById.get(technicianId) : undefined,
        siteOrigin,
      );

      if ("skip" in resolved) {
        // `attempts` TIDAK ditambah: tidak ada yang dikirim, jadi tidak ada
        // percobaan kirim yang perlu dihitung.
        const { error: patchError } = await admin
          .from("cervise_notification_outbox")
          .update({ state: "failed", last_error: resolved.skip })
          .eq("id", row.id);
        if (patchError) throw new Error(`Patch baris ${row.id} gagal: ${patchError.message}`);
        result.failed += 1;
        continue;
      }

      // Dihitung SEKALI di sini dan dipakai di setiap jalur yang benar-benar
      // memanggil Fonnte. `row.attempts` masih nilai sebelum percobaan ini,
      // karena claim tidak menyentuhnya.
      const attempts = row.attempts + 1;

      let response: Awaited<ReturnType<typeof sendFonnteWA>>;
      try {
        response = await sendFonnteWA(resolved.target, resolved.message, COUNTRY_CODE);
      } catch (error) {
        // Hanya kegagalan yang memang soal nomor atau isi pesannya yang
        // terminal. Token kedaluwarsa atau Fonnte sedang erred scope-nya
        // infrastruktur: pesannya masih layak, jadi dicoba lagi sampai
        // anggaran habis. Error yang bukan FonnteError diperlakukan sama --
        // bug di kode ini sendiri tidak boleh membuang notifikasi.
        const terminal = error instanceof FonnteError && error.scope === "message";
        const lastError = errorText(error);

        if (terminal || attempts >= MAX_ATTEMPTS) {
          const { error: patchError } = await admin
            .from("cervise_notification_outbox")
            .update({ state: "failed", last_error: lastError, attempts })
            .eq("id", row.id);
          if (patchError) throw new Error(`Patch baris ${row.id} gagal: ${patchError.message}`);
        } else {
          const { error: patchError } = await admin
            .from("cervise_notification_outbox")
            .update({
              state: "pending",
              last_error: lastError,
              attempts,
              next_attempt_at: backoffIso(attempts, now),
            })
            .eq("id", row.id);
          if (patchError) throw new Error(`Patch baris ${row.id} gagal: ${patchError.message}`);
        }
        result.failed += 1;
        continue;
      }

      // `skip` berarti FONNTE_TOKEN belum diisi: keadaan yang disengaja, bukan
      // error, dan tidak ada permintaan yang keluar -- jadi `attempts` tidak
      // bertambah. Kembalikan nol juga akan menutupi antrean yang menumpuk
      // selama Fonnte mati, jadi tetap dihitung dan terlihat di log cron.
      if (response.skip) {
        const { error: patchError } = await admin
          .from("cervise_notification_outbox")
          .update({ state: "skipped", last_error: "fonnte_not_configured" })
          .eq("id", row.id);
        if (patchError) throw new Error(`Patch baris ${row.id} gagal: ${patchError.message}`);
        result.skipped += 1;
        continue;
      }

      // `sent_at` hanya ditulis di sini, di satu-satunya tempat pesan benar-benar
      // keluar. Menuliskannya pada baris yang dilewati membuat kolom itu
      // berbohong.
      const { error: patchError } = await admin
        .from("cervise_notification_outbox")
        .update({
          state: "sent",
          sent_at: now.toISOString(),
          last_error: null,
          attempts,
          provider_message_id: providerMessageIdOf(response.detail),
        })
        .eq("id", row.id);
      if (patchError) {
        // Pesan sudah terkirim tapi barisnya belum tahu. Melaporkan `sent`
        // menutup satu-satunya jejak masalahnya -- dan karena baris tetap
        // pending, pesannya akan dikirim lagi. Hitung `failed` supaya log cron
        // menunjukkan ada yang perlu dilihat.
        throw new Error(`Patch baris ${row.id} gagal: ${patchError.message}`);
      }
      result.sent += 1;
    } catch {
      // Baris ini tidak bisa dicatat, dan penyebabnya sengaja tidak dicoba
      // disimpan di sini: patch-nya sendiri yang gagal, jadi patch kedua hanya
      // akan gagal lagi, dan `last_error` yang ditulis sembarangan lebih buruk
      // daripada tidak menulis apa-apa.
      //
      // Barisnya masih pending di bawah lease, jadi akan dicoba lagi pada tick
      // berikutnya -- dan itu memang jalur pemulihan untuk worker yang tumbang
      // di tengah jalan. Yang penting: baris lain tetap jalan.
      result.failed += 1;
    }
  }

  return result;
}
