"use server";

import { mapServisListRows, type ServisListRow } from "@/lib/operational/servis-list";
import { kalenderWIB } from "@/lib/operational/periode-bulan";
import { sanitizeSearchTerm } from "@/lib/search-term";

export type KondisiStatus = "normal" | "tidak_normal";
export type KondisiAwal = Record<string, { status: KondisiStatus; note: string }>;

export type CreateServisPayload = {
  teknisi_id: string;
  merk: string;
  tipe: string;
  // Keduanya boleh null: kolomnya nullable di database, dan IMEI tidak selalu
  // ada (mis. perangkat tanpa IMEI, atau tidak diketahui kasir). `null`
  // disengaja, bukan string kosong -- string kosong akan cocok dengan pencarian
  // IMEI kosong dan unenforceable.
  imei1?: string | null;
  imei2?: string | null;
  kerusakan: string[];
  kelengkapan: string[];
  password_type: "PIN" | "POLA";
  password_value: string;
  customer_name: string;
  customer_address?: string;
  customer_phone: string;
  garansi_value: number;
  garansi_unit: "hari" | "bulan" | "tahun";
  price_estimasi?: number | null;
  // hidden: created_by & branch_id derived server-side
};

export type UpdateServisPayload = Partial<CreateServisPayload> & { id: string };

import { getActiveTenant } from "@/lib/supabase/actor";
import { canAccess } from "@/lib/rbac";
import { isManagerRole } from "@/lib/auth/authorization";

async function getBranchAndUser() {
  const actor = await getActiveTenant();
  if (!actor.branchId) throw new Error("Branch not set for tenant");
  return { supabase: actor.supabase, userId: actor.userId, branchId: actor.branchId, role: actor.role, orgId: actor.orgId };
}

export async function getServisList(): Promise<ServisListRow[]> {
  const { supabase, branchId } = await getBranchAndUser();
  const { data: services, error: servicesError } = await supabase
    .from("cervise_services")
    .select("id, service_number, tracking_code, device, complaint, status, price, customer_id, teknisi_id, created_at")
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (servicesError) throw new Error(servicesError.message);
  const serviceRows = (services ?? []) as {
    id: string;
    service_number: string | null;
    tracking_code: string | null;
    device: string;
    complaint: string | null;
    status: string;
    price: number;
    customer_id: string | null;
    teknisi_id: string | null;
    created_at: string;
  }[];
  if (serviceRows.length === 0) return [];

  const customerIds = serviceRows.map((service) => service.customer_id).filter((id): id is string => Boolean(id));
  const teknisiIds = serviceRows.map((service) => service.teknisi_id).filter((id): id is string => Boolean(id));
  const [customersResult, profilesResult, financeResult] = await Promise.all([
    customerIds.length ? supabase.from("cervise_customers").select("id, name, phone").in("id", customerIds) : Promise.resolve({ data: [], error: null }),
    teknisiIds.length ? supabase.from("profiles").select("id, full_name").in("id", teknisiIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("finance_tx").select("servis_id, amount").eq("branch_id", branchId).eq("type", "pemasukan").in("servis_id", serviceRows.map((service) => service.id)),
  ]);
  if (customersResult.error) throw new Error(customersResult.error.message);
  if (profilesResult.error) throw new Error(profilesResult.error.message);
  if (financeResult.error) throw new Error(financeResult.error.message);

  return mapServisListRows({
    services: serviceRows,
    customers: (customersResult.data ?? []) as { id: string; name: string; phone: string | null }[],
    profiles: (profilesResult.data ?? []) as { id: string; full_name: string | null }[],
    finance: (financeResult.data ?? []) as { servis_id: string; amount: number }[],
  });
}

export async function getTeknisi() {
  const { supabase, branchId, orgId } = await getBranchAndUser();
  // employees adalah sumber otoritas role dan cabang. profiles.branch_id tidak
  // pernah diisi createKaryawan, jadi memfilter profiles membuat dropdown ini
  // kosong. Yang dikembalikan tetap profiles.id karena
  // cervise_services.teknisi_id mereferensikan profiles(id).
  const { data, error } = await supabase
    .from("employees")
    .select("profile_id, profiles!inner(id, full_name, phone)")
    .eq("organization_id", orgId)
    .eq("branch_id", branchId)
    .eq("role", "TECHNICIAN")
    .eq("is_active", true)
    .order("full_name", { referencedTable: "profiles" });
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => {
    const embedded = row.profiles as unknown;
    const profile = (Array.isArray(embedded) ? embedded[0] : embedded) as
      | { id: string; full_name: string | null; phone: string | null }
      | null;
    if (!profile) return [];
    return [{ id: profile.id, full_name: profile.full_name, phone: profile.phone ?? null }];
  });
}

export async function searchCustomers(q: string) {
  const { supabase, branchId } = await getBranchAndUser();
  const term = sanitizeSearchTerm(q);
  if (term.length < 1) return [];
  const { data, error } = await supabase
    .from("cervise_customers")
    .select("id, name, phone, address")
    .eq("branch_id", branchId)
    .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
    .limit(8);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Tag kerusakan untuk form servis.
 *
 * Lewat `search_service_tags` supaya `%` dan `_` dari user dibaca sebagai
 * karakter biasa. Dengan `.ilike` langsung, mengetik `%` di kotak pencarian
 * menarik seluruh katalog tag cabang.
 */
export async function searchTags(q: string) {
  const { supabase, branchId } = await getBranchAndUser();
  const { data, error } = await supabase.rpc("search_service_tags", {
    p_branch_id: branchId,
    p_term: q,
    p_limit: 10,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { name: string }[]).map((row) => row.name);
}

export async function getKelengkapanOptions() {
  const { supabase, branchId } = await getBranchAndUser();
  const { data, error } = await supabase
    .from("cervise_kelengkapan_options")
    .select("name")
    .eq("branch_id", branchId)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => d.name as string);
}

export async function createServis(payload: CreateServisPayload) {
  const { supabase, userId, branchId } = await getBranchAndUser();

  // validation server-side (teknisi wajib)
  if (!payload.teknisi_id) throw new Error("Teknisi wajib diisi");
  if (!payload.merk || !payload.tipe) throw new Error("Merk & Tipe wajib");
  if (payload.kerusakan == null || payload.kerusakan.length === 0) throw new Error("Kerusakan minimal 1");
  if (!payload.customer_name || !payload.customer_phone) throw new Error("Nama & WA wajib");
  if (!payload.password_type || !payload.password_value) throw new Error("Password device wajib");
  if (!payload.garansi_value || !payload.garansi_unit) throw new Error("Garansi wajib");

  // normalize kerusakan lowercase & dedup
  const kerusakanNorm = Array.from(
    new Set(payload.kerusakan.map((k) => k.trim()).filter(Boolean).map((k) => k.toLowerCase()))
  );
  const kelengkapanNorm = Array.from(
    new Set(payload.kelengkapan.map((k) => k.trim()).filter(Boolean))
  );

  // customer: find by phone exact or create
  let customerId: string | null = null;
  const { data: existing } = await supabase
    .from("cervise_customers")
    .select("id")
    .eq("branch_id", branchId)
    .eq("phone", payload.customer_phone.trim())
    .maybeSingle();

  if (existing?.id) {
    customerId = existing.id as string;
    // optionally update name/address if changed
    await supabase
      .from("cervise_customers")
      .update({ name: payload.customer_name.trim(), address: payload.customer_address?.trim() || null })
      .eq("id", customerId);
  } else {
    // Query kedua dengan `ilike("name")` yang pernah ada di sini tidak mungkin
    // mengembalikan apa pun: kondisinya lebih sempit dari query pertama di atas
    // (branch + phone sama, ditambah nama), jadi kalau query pertama tidak
    // menemukan baris, query kedua juga tidak.
    const { data: ins, error: insErr } = await supabase
      .from("cervise_customers")
      .insert({
        branch_id: branchId,
        name: payload.customer_name.trim(),
        phone: payload.customer_phone.trim(),
        address: payload.customer_address?.trim() || null,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    customerId = ins.id as string;
  }

  // kelengkapan custom hanya untuk form ini, tidak disimpan permanen (sesuai revisi)
  // sengaja tidak insert ke cervise_kelengkapan_options

  // Counter tag naik lewat RPC, bukan baca-sulis di sini: dua kasir yang
  // membuat servis dengan kerusakan sama di detik sama akan saling menimpa
  // kalau angkanya dibaca lalu ditulis dari TypeScript.
  for (const k of kerusakanNorm) {
    const { error: tagError } = await supabase.rpc("bump_service_tag_usage", {
      p_branch_id: branchId,
      p_name: k,
      p_delta: 1,
    });
    if (tagError) throw new Error(tagError.message);
  }

  const deviceLabel = `${payload.merk.trim()} ${payload.tipe.trim()}`.trim();

  // `garansi_until` SENGAJA tidak diisi di sini. Garansi mulai saat pelanggan
  // mengambil perangkat, dan itu dihitung `set_service_status` ketika status
  // jadi 'Sudah Diambil'. Mengisinya sekarang membuat tanggalnya dihitung dari
  // saat servis masuk, jadi perbaikan yang butuh seminggu memotong garansi
  // pelanggan seminggu. Sampai diambil, halaman garansi menampilkan
  // "Belum aktif" - itu memang keadaannya.

  // Nomor servis dibuat di database supaya urutannya aman saat dua orang
  // membuat servis bersamaan di cabang yang sama.
  const { data: numberData, error: numberError } = await supabase.rpc("next_service_number", {
    p_branch_id: branchId,
  });
  if (numberError) throw new Error(numberError.message);

  const { data: svc, error: svcErr } = await supabase
    .from("cervise_services")
    .insert({
      branch_id: branchId,
      customer_id: customerId,
      service_number: (numberData as string | null) ?? null,
      device: deviceLabel,
      complaint: kerusakanNorm.join(", "),
      status: "Masuk",
      teknisi_id: payload.teknisi_id,
      price: 0,
      price_estimasi: payload.price_estimasi ?? null,
      merk: payload.merk.trim(),
      tipe: payload.tipe.trim(),
      imei1: payload.imei1?.trim() || null,
      imei2: payload.imei2?.trim() || null,
      kerusakan: kerusakanNorm,
      kelengkapan: kelengkapanNorm,
      password_type: payload.password_type,
      password_value: payload.password_value.trim(),
      garansi_value: payload.garansi_value,
      garansi_unit: payload.garansi_unit,
      kondisi_awal: {},
      created_by: userId,
    })
    .select("id")
    .single();

  if (svcErr) throw new Error(svcErr.message);
  // log create
  await supabase.from("cervise_service_logs").insert({ branch_id: branchId, servis_id: svc.id, actor_id: userId, action: "create", to_value: deviceLabel, payload: { merk: payload.merk, tipe: payload.tipe, kerusakan: kerusakanNorm } });
  return { id: svc.id as string };
}

export async function updateServis(payload: UpdateServisPayload) {
  const { supabase, branchId, userId } = await getBranchAndUser();
  const id = payload.id;
  if (!id) throw new Error("ID wajib");
  // fetch old kerusakan for adjust
  const { data: old } = await supabase.from("cervise_services").select("kerusakan").eq("id", id).eq("branch_id", branchId).single();
  const oldKerusakan: string[] = (old?.kerusakan as string[]) ?? [];

  // if kerusakan being updated, adjust usage_count
  if (payload.kerusakan) {
    const newNorm = Array.from(new Set(payload.kerusakan.map((k) => k.trim().toLowerCase()).filter(Boolean)));
    const removed = oldKerusakan.filter((k) => !newNorm.includes(k.toLowerCase()));
    const added = newNorm.filter((k) => !oldKerusakan.map((o) => o.toLowerCase()).includes(k));
    for (const [names, delta] of [
      [removed, -1],
      [added, 1],
    ] as const) {
      for (const name of names) {
        const { error: tagError } = await supabase.rpc("bump_service_tag_usage", {
          p_branch_id: branchId,
          p_name: name,
          p_delta: delta,
        });
        if (tagError) throw new Error(tagError.message);
      }
    }
    payload.kerusakan = newNorm;
  }

  // handle customer upsert if phone/name changed
  let customerId: string | undefined;
  if (payload.customer_name && payload.customer_phone) {
    const { data: existing } = await supabase.from("cervise_customers").select("id").eq("branch_id", branchId).eq("phone", payload.customer_phone.trim()).maybeSingle();
    if (existing?.id) {
      customerId = existing.id as string;
      await supabase.from("cervise_customers").update({ name: payload.customer_name.trim(), address: payload.customer_address?.trim() || null }).eq("id", customerId);
    } else {
      const { data: ins } = await supabase.from("cervise_customers").insert({ branch_id: branchId, name: payload.customer_name.trim(), phone: payload.customer_phone.trim(), address: payload.customer_address?.trim() || null }).select("id").single();
      if (ins) customerId = ins.id as string;
    }
  }

  const patch: Record<string, unknown> = {};
  if (payload.merk) patch.merk = payload.merk.trim();
  if (payload.tipe) patch.tipe = payload.tipe.trim();
  if (payload.merk || payload.tipe) {
    const merk = (payload.merk ?? "") as string;
    const tipe = (payload.tipe ?? "") as string;
    // need old merk/tipe if partial
    if (!payload.merk || !payload.tipe) {
      const { data: cur } = await supabase.from("cervise_services").select("merk, tipe").eq("id", id).single();
      patch.device = `${(payload.merk ?? cur?.merk ?? "").trim()} ${(payload.tipe ?? cur?.tipe ?? "").trim()}`.trim();
    } else {
      patch.device = `${merk.trim()} ${tipe.trim()}`.trim();
    }
  }
  if (payload.imei1) patch.imei1 = payload.imei1.trim();
  if (payload.imei2 !== undefined) patch.imei2 = payload.imei2?.trim() || null;
  if (payload.kerusakan) { patch.kerusakan = payload.kerusakan; patch.complaint = (payload.kerusakan as string[]).join(", "); }
  if (payload.kelengkapan) patch.kelengkapan = Array.from(new Set(payload.kelengkapan.map((k) => k.trim()).filter(Boolean)));
  if (payload.password_type) patch.password_type = payload.password_type;
  if (payload.password_value) patch.password_value = payload.password_value.trim();
  if (payload.garansi_value !== undefined) patch.garansi_value = payload.garansi_value;
  if (payload.garansi_unit) patch.garansi_unit = payload.garansi_unit;
  // `garansi_until` tidak dihitung ulang di sini: mengubah nilai garansi tidak
  // memindahkan tanggal mulai, karena tanggal itu ditetapkan saat perangkat
  // diambil. Lihat createServis.
  if (payload.price_estimasi !== undefined) patch.price_estimasi = payload.price_estimasi;
  if (payload.teknisi_id) patch.teknisi_id = payload.teknisi_id;
  if (customerId) patch.customer_id = customerId;
  // lock: never update created_by
  if (Object.keys(patch).length === 0) throw new Error("Tidak ada perubahan");
  const { error } = await supabase.from("cervise_services").update(patch).eq("id", id).eq("branch_id", branchId);
  if (error) throw new Error(error.message);
  const beforeAfter = Object.keys(patch).map((k) => `${k}: ${JSON.stringify((patch as any)[k])}`).join(", ");
  await supabase.from("cervise_service_logs").insert({ branch_id: branchId, servis_id: id, actor_id: userId, action: "edit_field", to_value: beforeAfter.slice(0, 200), payload: patch as any });
  return { id };
}

function assertCanDeleteServis(role: string) {
  if (!isManagerRole(role)) throw new Error("Hanya admin yang boleh menghapus servis");
}

export type ServisDeleteImpact = {
  paymentCount: number;
  paymentTotal: number;
  tagCount: number;
};

export async function getServisDeleteImpact(id: string): Promise<ServisDeleteImpact> {
  const { supabase, branchId, role } = await getBranchAndUser();
  assertCanDeleteServis(role);
  if (!id) throw new Error("ID wajib");
  const { data: service, error: serviceError } = await supabase
    .from("cervise_services")
    .select("kerusakan")
    .eq("id", id)
    .eq("branch_id", branchId)
    .maybeSingle();
  if (serviceError) throw new Error(serviceError.message);
  if (!service) throw new Error("Servis tidak ditemukan");
  const { data: payments, error: paymentsError } = await supabase
    .from("cervise_finance_tx")
    .select("amount")
    .eq("branch_id", branchId)
    .eq("servis_id", id)
    .eq("type", "pemasukan");
  if (paymentsError) throw new Error(paymentsError.message);
  const rows = (payments ?? []) as { amount: number }[];
  return {
    paymentCount: rows.length,
    paymentTotal: rows.reduce((total, row) => total + Number(row.amount ?? 0), 0),
    tagCount: Array.isArray(service.kerusakan) ? service.kerusakan.length : 0,
  };
}

export async function deleteServis(id: string) {
  const { supabase, branchId, role } = await getBranchAndUser();
  assertCanDeleteServis(role);
  if (!id) throw new Error("ID wajib");

  const { data: service, error: serviceError } = await supabase
    .from("cervise_services")
    .select("id, device, kerusakan")
    .eq("id", id)
    .eq("branch_id", branchId)
    .maybeSingle();
  if (serviceError) throw new Error(serviceError.message);
  if (!service) throw new Error("Servis tidak ditemukan");

  // Sparepart consumption already moved stock out of the catalog. Deleting the
  // service would cascade its lines away and silently lose that stock, so the
  // admin has to resolve the parts first.
  const { data: parts, error: partsError } = await supabase
    .from("cervise_service_spareparts")
    .select("id, name, qty")
    .eq("servis_id", id)
    .eq("is_returned", false);
  if (partsError) throw new Error(partsError.message);
  const consumed = (parts ?? []) as { name: string; qty: number }[];
  if (consumed.length > 0) {
    throw new Error(
      `Servis masih memakai ${consumed.length} sparepart (${consumed.map((p) => `${p.name} x${p.qty}`).join(", ")}). Kembalikan ke stok atau tetap terpakai sebelum dihapus.`,
    );
  }

  // finance_tx.servis_id is ON DELETE SET NULL, so income rows survive as orphans.
  // Count them so the caller can warn the admin before the row disappears.
  const { data: payments, error: paymentsError } = await supabase
    .from("cervise_finance_tx")
    .select("amount")
    .eq("branch_id", branchId)
    .eq("servis_id", id)
    .eq("type", "pemasukan");
  if (paymentsError) throw new Error(paymentsError.message);
  const paymentRows = (payments ?? []) as { amount: number }[];

  // The service row is about to disappear, so keep tag usage counters honest.
  const tags = (Array.isArray(service.kerusakan) ? service.kerusakan : []) as string[];
  for (const tag of tags) {
    const { error: tagError } = await supabase.rpc("bump_service_tag_usage", {
      p_branch_id: branchId,
      p_name: tag,
      p_delta: -1,
    });
    if (tagError) throw new Error(tagError.message);
  }

  // cervise_service_logs cascades away with the service, so the service timeline
  // is intentionally destroyed here. platform_audit_logs is platform-admin only,
  // so tenant deletions are not yet recorded anywhere.
  const { error: deleteError } = await supabase
    .from("cervise_services")
    .delete()
    .eq("id", id)
    .eq("branch_id", branchId);
  if (deleteError) throw new Error(deleteError.message);

  return {
    id,
    device: service.device,
    orphanedPaymentCount: paymentRows.length,
    orphanedPaymentTotal: paymentRows.reduce((total, row) => total + Number(row.amount ?? 0), 0),
  };
}

/**
 * Mencatat pembayaran servis.
 *
 * Satu-satunya jalur: RPC `record_service_payment` menulis faktur
 * (`cervise_sales` dengan `servis_id`), kas (`finance_tx`), dan total terbayar
 * (`cervise_services.price`) dalam satu transaksi.
 *
 * Dulu ada dua jalur yang menulis ke tabel berbeda - dialog kasir menulis
 * `cervise_sales`, drawer detail servis menulis `finance_tx` - jadi Laporan
 * Penjualan tidak melihat yang lewat drawer dan Arus Kas tidak melihat yang
 * lewat dialog. Sekarang keduanya melihat hal yang sama.
 *
 * `servis_id` di baris penjualan adalah pengait anti hitung-ganda di
 * `buildLaporanShift`: servis yang sudah punya penjualan keluar dari
 * `servicesTotal` dan masuk `salesTotal`, yang tahu metode pembayarannya.
 *
 * Konsekuensi: baris `cervise_sales` ini tidak punya `cervise_sales_items`,
 * jadi `getSalesOrders()` menampilkannya dengan qty 0. Menambah item dengan
 * produk dummy akan mengotori katalog stok, jadi itu dibiarkan.
 */
export async function addPembayaran(params: { servisId: string; amount: number; metode: "Tunai" | "Debit" | "Transfer" | "QRIS" | "E-Wallet"; kas_date?: string; keterangan?: string }) {
  const { supabase, branchId, userId, role } = await getBranchAndUser();
  if (!canAccess(role, "keuangan_transaksi")) throw new Error("Hanya admin/kasir boleh input pembayaran");
  if (!params.servisId) throw new Error("Servis ID wajib");
  if (!params.amount || !Number.isFinite(params.amount) || params.amount <= 0) throw new Error("Nominal harus >0");
  if (!["Tunai", "Debit", "Transfer", "QRIS", "E-Wallet"].includes(params.metode)) throw new Error("Metode tidak valid");

  const { data, error } = await supabase.rpc("record_service_payment", {
    p_branch_id: branchId,
    p_servis_id: params.servisId,
    p_amount: Math.round(params.amount),
    p_metode: params.metode,
    p_kas_date: params.kas_date ?? kalenderWIB(),
    p_keterangan: params.keterangan?.trim() || null,
    p_created_by: userId,
  });
  if (error) throw new Error(error.message);

  const result = data as { total?: number } | null;
  return { ok: true, total: Number(result?.total ?? 0) };
}

export async function getPembayaranHistory(servisId: string) {
  const { supabase, branchId } = await getBranchAndUser();
  const { data, error } = await supabase
    .from("finance_tx")
    .select("id, amount, metode, keterangan, description, kas_date, created_at, created_by")
    .eq("branch_id", branchId)
    .eq("servis_id", servisId)
    .order("kas_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateKondisiAwal(serviceId: string, kondisi: KondisiAwal) {
  const { supabase, branchId } = await getBranchAndUser();
  const { error } = await supabase
    .from("cervise_services")
    .update({ kondisi_awal: kondisi })
    .eq("id", serviceId)
    .eq("branch_id", branchId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getServisDetail(id: string) {
  const { supabase, branchId } = await getBranchAndUser();
  const { data, error } = await supabase
    .from("cervise_services")
    .select(
      "id, branch_id, service_number, tracking_code, device, complaint, status, price, price_estimasi, garansi_until, created_at, merk, tipe, imei1, imei2, kerusakan, kelengkapan, password_type, password_value, garansi_value, garansi_unit, kondisi_awal, customer_id, teknisi_id, created_by, cervise_customers(id, name, phone, address)"
    )
    .eq("id", id)
    .eq("branch_id", branchId)
    .single();
  if (error) throw new Error(error.message);
  // fetch teknisi & creator safely without FK alias guess
  let teknisi: { id: string; full_name: string | null; email: string | null } | null = null;
  let creator: { id: string; full_name: string | null; email: string | null } | null = null;
  if (data.teknisi_id) {
    const { data: t } = await supabase.from("profiles").select("id, full_name, email").eq("id", data.teknisi_id).single();
    teknisi = t as typeof teknisi;
  }
  if (data.created_by) {
    const { data: c } = await supabase.from("profiles").select("id, full_name, email").eq("id", data.created_by).single();
    creator = c as typeof creator;
  }
  return { ...data, teknisi, creator };
}

export type ServisDetail = Awaited<ReturnType<typeof getServisDetail>>;

export async function getServisLogs(servisId: string) {
  const { supabase, branchId } = await getBranchAndUser();
  const { data, error } = await supabase
    .from("cervise_service_logs")
    .select("id, action, from_value, to_value, payload, created_at, actor_id")
    .eq("branch_id", branchId)
    .eq("servis_id", servisId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  // enrich actor names
  const actorIds = Array.from(new Set((data ?? []).map((d: any) => d.actor_id).filter(Boolean)));
  let actors: Record<string, { full_name: string | null; email: string | null }> = {};
  if (actorIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", actorIds as string[]);
    for (const p of (profiles ?? []) as any[]) actors[p.id] = p;
  }
  return (data ?? []).map((d: any) => ({ ...d, actor: actors[d.actor_id] ?? null }));
}
export type ServisLog = Awaited<ReturnType<typeof getServisLogs>>[number];
