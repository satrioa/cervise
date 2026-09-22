"use server";

import { createClient } from "@/lib/supabase/server";

export type KondisiStatus = "normal" | "tidak_normal";
export type KondisiAwal = Record<string, { status: KondisiStatus; note: string }>;

const KONDISI_ITEMS_INTERNAL = [
  "Battery",
  "Screen",
  "Speaker",
  "Face ID",
  "Camera",
  "Button Volume",
  "Signal",
  "Port Charging",
  "Button On/Off",
  "Mic",
  "Backglass & Backdoor",
] as const;

export type CreateServisPayload = {
  teknisi_id: string;
  merk: string;
  tipe: string;
  imei1: string;
  imei2?: string;
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

async function getBranchAndUser() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");
  const { data: profile } = await supabase
    .from("cervise_profiles")
    .select("id, branch_id, role")
    .eq("id", auth.user.id)
    .single();
  if (!profile?.branch_id) throw new Error("Branch not found for user");
  return { supabase, userId: auth.user.id, branchId: profile.branch_id as string, role: profile.role };
}

export async function getTeknisi() {
  const { supabase, branchId } = await getBranchAndUser();
  const { data, error } = await supabase
    .from("cervise_profiles")
    .select("id, full_name, email, role")
    .eq("branch_id", branchId)
    .eq("role", "teknisi")
    .order("full_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function searchCustomers(q: string) {
  const { supabase, branchId } = await getBranchAndUser();
  const term = q.trim();
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

export async function searchTags(q: string) {
  const { supabase, branchId } = await getBranchAndUser();
  const term = q.trim().toLowerCase();
  if (term.length < 1) {
    const { data } = await supabase
      .from("cervise_service_tags")
      .select("name, usage_count")
      .eq("branch_id", branchId)
      .order("usage_count", { ascending: false })
      .limit(10);
    return (data ?? []).map((d) => d.name as string);
  }
  const { data, error } = await supabase
    .from("cervise_service_tags")
    .select("name")
    .eq("branch_id", branchId)
    .ilike("name", `%${term}%`)
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => d.name as string);
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
  if (!payload.imei1) throw new Error("IMEI 1 wajib");
  if (!payload.kerusakan || payload.kerusakan.length === 0) throw new Error("Kerusakan minimal 1");
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
    // also try by name ilike if phone not found but same name (prevent dup loosely)
    const { data: byName } = await supabase
      .from("cervise_customers")
      .select("id")
      .eq("branch_id", branchId)
      .ilike("name", payload.customer_name.trim())
      .eq("phone", payload.customer_phone.trim())
      .maybeSingle();
    if (byName?.id) {
      customerId = byName.id as string;
    } else {
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
  }

  // kelengkapan custom hanya untuk form ini, tidak disimpan permanen (sesuai revisi)
  // sengaja tidak insert ke cervise_kelengkapan_options

  // upsert kerusakan tags + usage_count
  for (const k of kerusakanNorm) {
    const { data: existingTag } = await supabase
      .from("cervise_service_tags")
      .select("id, usage_count")
      .eq("branch_id", branchId)
      .ilike("name", k)
      .maybeSingle();
    if (existingTag) {
      await supabase
        .from("cervise_service_tags")
        .update({ usage_count: (existingTag.usage_count as number) + 1 })
        .eq("id", existingTag.id);
    } else {
      await supabase.from("cervise_service_tags").insert({ branch_id: branchId, name: k, usage_count: 1 });
    }
  }

  const deviceLabel = `${payload.merk.trim()} ${payload.tipe.trim()}`.trim();

  const { data: svc, error: svcErr } = await supabase
    .from("cervise_services")
    .insert({
      branch_id: branchId,
      customer_id: customerId,
      device: deviceLabel,
      complaint: kerusakanNorm.join(", "),
      status: "Masuk",
      teknisi_id: payload.teknisi_id,
      price: 0,
      price_estimasi: payload.price_estimasi ?? null,
      merk: payload.merk.trim(),
      tipe: payload.tipe.trim(),
      imei1: payload.imei1.trim(),
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
    for (const r of removed) {
      const { data: tag } = await supabase.from("cervise_service_tags").select("id, usage_count").eq("branch_id", branchId).ilike("name", r).maybeSingle();
      if (tag) await supabase.from("cervise_service_tags").update({ usage_count: Math.max(0, (tag.usage_count as number) - 1) }).eq("id", tag.id);
    }
    for (const a of added) {
      const { data: tag } = await supabase.from("cervise_service_tags").select("id, usage_count").eq("branch_id", branchId).ilike("name", a).maybeSingle();
      if (tag) await supabase.from("cervise_service_tags").update({ usage_count: (tag.usage_count as number) + 1 }).eq("id", tag.id);
      else await supabase.from("cervise_service_tags").insert({ branch_id: branchId, name: a, usage_count: 1 });
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

export async function addPembayaran(params: { servisId: string; amount: number; metode: "Tunai" | "Debit" | "Transfer" | "QRIS" | "E-Wallet"; kas_date?: string; keterangan?: string }) {
  const { supabase, branchId, userId, role } = await getBranchAndUser();
  if (!["super_owner", "master_admin", "admin"].includes(role as string)) throw new Error("Hanya admin/kasir boleh input pembayaran");
  if (!params.servisId) throw new Error("Servis ID wajib");
  if (!params.amount || params.amount <= 0) throw new Error("Nominal harus >0");
  if (!params.metode) throw new Error("Metode wajib");
  const kasDate = params.kas_date ?? new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("cervise_finance_tx").insert({
    branch_id: branchId,
    servis_id: params.servisId,
    type: "pemasukan",
    amount: Math.round(params.amount),
    kas_date: kasDate,
    metode: params.metode,
    keterangan: params.keterangan ?? null,
    description: params.keterangan ?? `Pembayaran servis ${params.servisId} - ${params.metode}`,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
  // update total price = sum finance_tx for this servis
  const { data: sums } = await supabase.from("cervise_finance_tx").select("amount").eq("servis_id", params.servisId).eq("branch_id", branchId).eq("type", "pemasukan");
  const total = (sums ?? []).reduce((a, b) => a + Number(b.amount), 0);
  await supabase.from("cervise_services").update({ price: total }).eq("id", params.servisId).eq("branch_id", branchId);
  return { ok: true, total };
}

export async function getPembayaranHistory(servisId: string) {
  const { supabase, branchId } = await getBranchAndUser();
  const { data, error } = await supabase
    .from("cervise_finance_tx")
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
      "id, branch_id, device, complaint, status, price, price_estimasi, garansi_until, created_at, merk, tipe, imei1, imei2, kerusakan, kelengkapan, password_type, password_value, garansi_value, garansi_unit, kondisi_awal, customer_id, teknisi_id, created_by, cervise_customers(id, name, phone, address)"
    )
    .eq("id", id)
    .eq("branch_id", branchId)
    .single();
  if (error) throw new Error(error.message);
  // fetch teknisi & creator safely without FK alias guess
  let teknisi: { id: string; full_name: string | null; email: string | null } | null = null;
  let creator: { id: string; full_name: string | null; email: string | null } | null = null;
  if (data.teknisi_id) {
    const { data: t } = await supabase.from("cervise_profiles").select("id, full_name, email").eq("id", data.teknisi_id).single();
    teknisi = t as typeof teknisi;
  }
  if (data.created_by) {
    const { data: c } = await supabase.from("cervise_profiles").select("id, full_name, email").eq("id", data.created_by).single();
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
    const { data: profiles } = await supabase.from("cervise_profiles").select("id, full_name, email").in("id", actorIds as string[]);
    for (const p of (profiles ?? []) as any[]) actors[p.id] = p;
  }
  return (data ?? []).map((d: any) => ({ ...d, actor: actors[d.actor_id] ?? null }));
}
export type ServisLog = Awaited<ReturnType<typeof getServisLogs>>[number];
