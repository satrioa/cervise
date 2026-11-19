import { MetaWaError, sendMetaWA, type TemplateParameter } from "@/lib/meta-wa";
import { toFonnteTarget } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicLacakUrl, type ServiceMessageInput, type ShiftMessageInput } from "./service-message";
import { getWaTemplate, type WaTemplateKey } from "./wa-templates";

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
// Anak tangga PERCobaan ke-1..ke-3, karena percobaan ke-4 sudah terminal.
// Indeks ke-3 (120 menit) tidak pernah dipakai: MAX_ATTEMPTS = 4 menghentikan
// baris di attempts = 4, jadi hanya 2, 5, dan 30 yang dijangkau. Menyingkirkan
// entri mati lebih baik daripada membiarkannya, karena pembaca kode lain akan
// menghitung anak tangga dari konstanta ini.
// Anak tangga pertama TIDAK boleh lebih pendek dari 2 menit, yaitu lease yang
// dipasang claim. Retry yang lebih cepat dari lease sendiri memendekkan lease
// itu sendiri: baris bisa terambil pada tick yang sama dengan tick yang baru
// melepaskannya, dan dua konstanta jadi berbeda pendapat soal jarak minimum.
const BACKOFF_MINUTES = [2, 5, 30, 120];
const DEFAULT_LIMIT = 25;

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
  branch_id: string;
  organization_id: string | null;
  servis_id: string | null;
  event: string;
  to_kind: string;
  to_status: string | null;
  payload: Record<string, string | number> | null;
  attempts: number;
};

type ServisRow = {
  id: string;
  service_number: string | null;
  device: string;
  complaint: string | null;
  tracking_code: string | null;
  status: string | null;
  price_estimasi: number | null;
  garansi_value: number | null;
  garansi_unit: "hari" | "bulan" | "tahun" | null;
  customer_id: string | null;
  teknisi_id: string | null;
  branches: {
    name: string | null;
    organization_id: string | null;
    organizations: { name: string; slug: string; meta_phone_number_id: string | null } | null;
  } | null;
};

type EmployeeRef = { organization_id: string; is_active: boolean };
type TechnicianRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  employees: EmployeeRef[] | null;
};
type CustomerRow = { id: string; name: string | null; phone: string | null };
type OwnerOrg = {
  name: string;
  owner_phone: string | null;
  contact_phone: string | null;
  meta_phone_number_id: string | null;
};

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
type Resolved =
  | {
      target: string;
      template: string;
      language: "id" | "en";
      parameters: TemplateParameter[];
      phoneNumberId: string;
      buttonUrl?: string;
    }
  | { skip: string };

function backoffIso(attempts: number, from: Date): string {
  const index = Math.min(Math.max(attempts, 1) - 1, BACKOFF_MINUTES.length - 1);
  return new Date(from.getTime() + BACKOFF_MINUTES[index] * 60_000).toISOString();
}

/**
 * Meta membalas `{ messages: [{ id }] }`. Bentuknya bisa berubah, jadi ID dibaca
 * secara defensif dan kegagalan membaca TIDAK membatalkan pengiriman: ID hanya
 * berguna untuk rekonsiliasi, sedangkan membatalkan kirim demi ID yang tidak
 * terbaca justru membuang notifikasi yang sudah sampai.
 */
function providerMessageIdOf(detail: unknown): string | null {
  const messages = (detail as { messages?: { id?: unknown }[] } | null)?.messages;
  const id = messages?.[0]?.id;
  if (typeof id === "string" && id.trim() !== "") return id;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return null;
}

/**
 * Nilai untuk kolom `last_error`.
 *
 * `MetaWaError.reason` dipakai, bukan `Error.message`: message-nya berawalan
 * "Meta WhatsApp gagal: " sedangkan `reason` adalah nilai mentahnya -- "invalid
 * parameter", "HTTP 401" -- yang bisa dicari dan dibandingkan. Kolom ini dibaca
 * operator saat menelusuri antrean, jadi bentuk yang bisa dipetik lebih berharga
 * daripada yang enak dibaca.
 */
function errorText(error: unknown): string {
  if (error instanceof MetaWaError) return error.reason;
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
  ownerOrg: OwnerOrg | undefined,
  siteOrigin: string,
): Resolved {
  // Notifikasi shift ditujukan ke owner tenant, bukan ke customer/teknisi.
  if (row.to_kind === "owner") {
    if (row.event !== "shift_opened" && row.event !== "shift_closed") {
      return { skip: "unsupported_owner_event" };
    }
    if (!ownerOrg) return { skip: "organization_not_found" };
    const target = toFonnteTarget(ownerOrg.owner_phone ?? ownerOrg.contact_phone);
    if (!target) return { skip: "no_phone" };
    const template = getWaTemplate(row.event === "shift_opened" ? "shift_open" : "shift_closed");
    if (!template.name) return { skip: "template_not_configured" };
    return {
      target,
      template: template.name,
      language: template.language,
      parameters: template.build((row.payload ?? {}) as ServiceMessageInput & Partial<ShiftMessageInput>),
      phoneNumberId: ownerOrg.meta_phone_number_id?.trim() || process.env.META_WA_PHONE_NUMBER_ID || "",
    };
  }

  if (row.to_kind !== "customer" && row.to_kind !== "technician") {
    return { skip: "unsupported_recipient" };
  }

  // `servis_id` sengaja tidak punya foreign key supaya riwayat pengiriman
  // bertahan setelah servis dihapus. Baris yatim tidak bisa disusun lagi.
  if (!servis) return { skip: "servis_not_found" };

  if (row.to_kind === "technician" && row.event !== "servis_created") {
    return { skip: "unsupported_technician_event" };
  }

  const org = servis.branches?.organizations ?? null;
  const phoneNumberId = org?.meta_phone_number_id?.trim() || process.env.META_WA_PHONE_NUMBER_ID || "";
  const input: ServiceMessageInput = {
    storeName: org?.name ?? "",
    tenantSlug: org?.slug ?? null,
    serviceId: servis.id,
    serviceNumber: servis.service_number,
    device: servis.device,
    complaint: servis.complaint,
    trackingCode: servis.tracking_code,
    status: row.to_status ?? servis.status,
    siteOrigin,
    priceEstimasi: servis.price_estimasi,
    garansiValue: servis.garansi_value,
    garansiUnit: servis.garansi_unit,
    customerName: customer?.name ?? "",
    tenantName: org?.name ?? "",
    branchName: servis.branches?.name ?? "",
    technicianName: technician?.full_name ?? "",
  };

  if (row.to_kind === "customer") {
    if (!customer) return { skip: "customer_not_found" };
    const target = toFonnteTarget(customer.phone);
    if (!target) return { skip: "no_phone" };
    const key: WaTemplateKey =
      row.event === "servis_created" ? "servis_created_customer" : "servis_status_customer";
    const template = getWaTemplate(key);
    if (!template.name) return { skip: "template_not_configured" };
    return {
      target,
      template: template.name,
      language: template.language,
      parameters: template.build(input),
      phoneNumberId,
      // servis_masuk_v2 punya URL button; isi dengan tautan lacak yang sama
      // seperti yang dipakai pesan teks.
      buttonUrl:
        key === "servis_created_customer"
          ? publicLacakUrl(input.siteOrigin, input.tenantSlug, input.trackingCode)
          : undefined,
    };
  }

  if (!technician) return { skip: "technician_not_found" };

  const branchOrganizationId = servis.branches?.organization_id ?? null;
  const activeCount = (technician.employees ?? []).filter((employee) => {
    if (!employee.is_active) return false;
    return branchOrganizationId === null || employee.organization_id === branchOrganizationId;
  }).length;
  if (activeCount === 0) return { skip: "technician_inactive" };

  const target = toFonnteTarget(technician.phone);
  if (!target) return { skip: "no_phone" };
  const template = getWaTemplate("servis_created_technician");
  if (!template.name) return { skip: "template_not_configured" };
  return {
    target,
    template: template.name,
    language: template.language,
    parameters: template.build(input),
    phoneNumberId,
  };
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
        "id, service_number, device, complaint, tracking_code, status, price_estimasi, garansi_value, garansi_unit, customer_id, teknisi_id, branches(name, organization_id, organizations(name, slug, meta_phone_number_id))",
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
      .select("id, name, phone")
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
      .select("id, full_name, phone, employees(organization_id, is_active)")
      .in("id", technicianIds);
    if (techError) {
      throw new Error(`Pengambilan data teknisi gagal: ${techError.message}`);
    }
    for (const row of (techRows ?? []) as TechnicianRow[]) techniciansById.set(row.id, row);
  }

  const ownerBranchIds = [
    ...new Set(rows.filter((row) => row.to_kind === "owner").map((row) => row.branch_id)),
  ];
  const ownerOrgsById = new Map<string, OwnerOrg>();
  if (ownerBranchIds.length) {
    const { data: branchRows, error: branchError } = await admin
      .from("branches")
      .select("id, organizations(name, owner_phone, contact_phone, meta_phone_number_id)")
      .in("id", ownerBranchIds);
    if (branchError) {
      throw new Error(`Pengambilan data tenant gagal: ${branchError.message}`);
    }
    for (const row of (branchRows ?? []) as unknown as {
      id: string;
      organizations: OwnerOrg | null;
    }[]) {
      if (row.organizations) ownerOrgsById.set(row.id, row.organizations);
    }
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
        ownerOrgsById.get(row.branch_id),
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
      // memanggil Meta WhatsApp. `row.attempts` masih nilai sebelum percobaan ini,
      // karena claim tidak menyentuhnya.
      const attempts = row.attempts + 1;

      // Kuota lokal tenant: cek sebelum kirim. Pesan yang habis kuotanya
      // diparkir sebagai pending (bukan terminal) dan tidak memanggil Meta.
      if (row.organization_id) {
        const { data: hasQuota, error: quotaError } = await admin.rpc("check_wa_quota", {
          p_organization_id: row.organization_id,
          p_count: 1,
        });
        if (!quotaError && hasQuota === false) {
          const { error: patchError } = await admin
            .from("cervise_notification_outbox")
            .update({
              state: "pending",
              last_error: "wa_quota_exhausted",
              next_attempt_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
            })
            .eq("id", row.id);
          if (patchError) throw new Error(`Patch baris ${row.id} gagal: ${patchError.message}`);
          result.skipped += 1;
          continue;
        }
      }

      let response: Awaited<ReturnType<typeof sendMetaWA>>;
      try {
        response = await sendMetaWA(
          resolved.target,
          resolved.template,
          resolved.parameters,
          resolved.phoneNumberId,
          resolved.language,
          resolved.buttonUrl,
        );
      } catch (error) {
        // Hanya kegagalan yang memang soal nomor atau isi pesannya yang
        // terminal. Token kedaluwarsa atau Meta sedang erred scope-nya
        // infrastruktur: pesannya masih layak, jadi dicoba lagi sampai
        // anggaran habis. Error yang bukan MetaWaError diperlakukan sama --
        // bug di kode ini sendiri tidak boleh membuang notifikasi.
        const terminal = error instanceof MetaWaError && error.scope === "message";
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

      // `skip` berarti kredensial Meta (META_WA_* / nama template) belum diisi:
      // keadaan yang disengaja, bukan error, dan tidak ada permintaan yang
      // keluar -- jadi `attempts` tidak bertambah. Kembalikan nol juga akan
      // menutupi antrean yang menumpuk selama Meta mati, jadi tetap dihitung dan
      // terlihat di log cron.
      if (response.skip) {
        // Meta WhatsApp belum dikonfigurasi. Baris TIDAK boleh jadi 'skipped':
        // state itu terminal (claim hanya mengambil state = 'pending') dan
        // dedupe_key-nya sudah terpakai di enqueue dengan on conflict do nothing,
        // jadi tidak ada jalan lagi untuk memunculkannya. Tick cron pertama di
        // lingkungan yang lupa memasang kredensial Meta akan menghapus seluruh
        // antrean secara permanen, dan memasangnya belakangan tidak memulihkan
        // apa pun.
        //
        // Jadi baris tetap pending, dijadwalkan ulang 30 menit, dan tetap
        // dihitung sebagai skipped di hasil run ini. skipped di sini berarti
        // "tidak dikirim pada run ini", bukan "selesai" -- dua makna itu berbeda
        // dan mencampurkannya yang dulu menghancurkan antrean. Kalau kredensial
        // dipasang, baris ini dikirim sendiri tanpa campur tangan.
        const { error: patchError } = await admin
          .from("cervise_notification_outbox")
          .update({
            state: "pending",
            last_error: "meta_wa_not_configured",
            next_attempt_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
          })
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
      // Hanya pesan yang benar-benar terkirim yang mengurangi kuota.
      if (row.organization_id) {
        const { error: consumeError } = await admin.rpc("consume_wa_quota", {
          p_organization_id: row.organization_id,
          p_count: 1,
        });
        if (consumeError) {
          console.error(`Gagal mencatat kuota WA untuk ${row.organization_id}: ${consumeError.message}`);
        }
      }
      result.sent += 1;
    } catch (error) {
      // Baris ini tidak bisa dicatat, dan penyebabnya sengaja tidak dicoba
      // disimpan di sini: patch-nya sendiri yang gagal, jadi patch kedua hanya
      // akan gagal lagi, dan `last_error` yang ditulis sembarangan lebih buruk
      // daripada tidak menulis apa-apa.
      //
      // Tapi dibuang dari log bukan berarti boleh hilang. Tujuan modul ini
      // membuat kegagalan terlihat, dan di sinilah satu-satunya tempat error
      // masih ada di tangan -- kalau dibuang, jejak masalahnya tinggal angka
      // `failed` yang naik tanpa sebab. Barisnya masih pending di bawah lease,
      // jadi akan dicoba lagi pada tick berikutnya -- dan itu memang jalur
      // pemulihan untuk worker yang tumbang di tengah jalan. Yang penting:
      // baris lain tetap jalan.
      console.error(
        `[dispatcher] baris ${row.id} (${row.event}/${row.to_kind}) gagal dicatat:`,
        error,
      );
      result.failed += 1;
    }
  }

  return result;
}
