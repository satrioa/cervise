"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { loadTodoMentions } from "@/lib/home/home-data";

/**
 * Mention customer dan servis di To-Do teknisi.
 *
 * Dua keputusan yang tidak bisa ditebak dari kode:
 *
 * 1. Pencarian TIDAK memfilter device. "iPhone" atau "Samsung" cocok dengan
 *    ratusan baris di cabang mana pun, dan teknisi yang sedang menulis
 *    catatan tidak sedang memilih di antara ratusan device -- dia sedang
 *    mengingat satu nomor servis atau satu nama. Pencarian dibatasi ke
 *    nomor servis dan nama customer, yang memang punya jawaban sedikit.
 *
 * 2. Label tidak disimpan. `label` dibaca ulang dari tabel tujuan setiap
 *    kali catatan dimuat, jadi customer yang di-rename atau servis yang
 *    nomornya berubah ikut tercermin di catatan lama. Menyimpan label
 *    berarti dua sumber kebenaran, dan yang salah adalah yang tertinggal.
 *
 * RLS `cervise_customers` dan `cervise_services` sudah membatasi ke cabang
 * yang bisa diakses akun ini, jadi tidak ada filter cabang manual di sini.
 * Menuliskannya lagi berisiko dua sumber kebenaran untuk batas yang sama.
 */
export type MentionKind = "customer" | "servis";

export type MentionTarget = {
  kind: MentionKind;
  id: string;
  label: string;
  sub: string | null;
};

export type TodoMention = MentionTarget & { mentionId: string; token: string; todoId: string };

export type MentionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function fail<T>(error: string): MentionResult<T> {
  return { ok: false, error };
}

const QUERY_MIN = 2;
const QUERY_MAX = 80;
const RESULT_LIMIT = 8;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bentuk token harus sama persis dengan yang diterima check di database.
 *
 * Divalidasi ulang di sini supaya mention dengan token aneh ditolak dengan
 * pesan yang bisa dibaca, bukan dengan pesan Postgres dari constraint yang
 * menggagalkan seluruh insert sekaligus.
 */
function isValidToken(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-z]{6,10}$/.test(value);
}

function cleanQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < QUERY_MIN || trimmed.length > QUERY_MAX) return null;
  return trimmed;
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Teks yang dicari Disertai wildcard PostgREST.
 *
 * Supabase memfilter lewat `ilike` dengan string mentah, jadi `Budi` tidak
 * akan cocok dengan "BUDI SANTOSO" tanpa wildcard. `,` dan `%` dibuang
 * supaya kueri tidak bisa diperluas jadi pemindaian seluruh tabel.
 */
function likePattern(q: string): string {
  return `%${q.replace(/[,%()*\\]/g, " ").replace(/\s+/g, " ").trim()}%`;
}

async function getContext() {
  const actor = await getActiveTenant();
  if (!actor.branchId) throw new Error("Cabang belum ditetapkan untuk akun ini");
  return { supabase: actor.supabase, branchId: actor.branchId, userId: actor.userId, role: actor.role };
}

/** Pelanggan dan servis yang bisa disebut di catatan. */
export async function searchMentionTargets(q: string): Promise<MentionResult<MentionTarget[]>> {
  const query = cleanQuery(q);
  if (!query) return fail(`Minimal ${QUERY_MIN} karakter untuk mencari`);

  const pattern = likePattern(query);
  const results: MentionTarget[] = [];

  try {
    const { supabase } = await getContext();

    // `ilike` pada nomor servis: teknisi mengingat nomornya, bukan nama
    // device-nya.
    const services = await supabase
      .from("cervise_services")
      .select("id, service_number, device, customer:branch_id")
      .ilike("service_number", pattern)
      .not("service_number", "is", null)
      .limit(RESULT_LIMIT);
    if (services.error) return fail(services.error.message);
    for (const row of (services.data ?? []) as {
      id: string;
      service_number: string | null;
      device: string | null;
    }[]) {
      results.push({
        kind: "servis",
        id: row.id,
        label: row.service_number ?? row.device ?? "Servis",
        sub: row.device ?? null,
      });
    }

    const customers = await supabase
      .from("cervise_customers")
      .select("id, name, phone")
      .ilike("name", pattern)
      .limit(RESULT_LIMIT);
    if (customers.error) return fail(customers.error.message);
    for (const row of (customers.data ?? []) as { id: string; name: string; phone: string }[]) {
      results.push({ kind: "customer", id: row.id, label: row.name, sub: row.phone });
    }

    // Servis dulu: kalau teknisi menulis nomor servis, itu yang dia cari.
    return { ok: true, data: results };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal mencari mention");
  }
}

/**
 * Mention milik satu catatan.
 *
 * `todoId` ikut dikembalikan supaya client bisa mengelompokkan mention per
 * catatan tanpa perlu kueri kedua. Tanpa itu, client harus searching
 * `find` per mention untuk mencari induknya.
 *
 * `in` dipisah ke kueri sendiri, bukan join `!inner`, supaya catatan tanpa
 * mention tetap ikut -- `!inner` membuang catatan itu dari hasil.
 */
export async function getTodoMentions(todoIds: string[]): Promise<MentionResult<TodoMention[]>> {
  if (todoIds.length === 0) return { ok: true, data: [] };

  try {
    return { ok: true, data: await loadTodoMentions(await getContext(), todoIds) };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal memuat mention");
  }
}

export type MentionInput = { kind: MentionKind; id: string; token: string };

/**
 * Tambahkan mention ke catatan milik pengguna ini.
 *
 * Token dibuat client dan ikut dikirim, supaya judul bisa disusun lengkap
 * dengan token SEBELUM catatan disimpan. Kalau token dibuat server, penyusunan
 * judul harus menunggu dua putaran bolak-balik.
 *
 * Mention yang sama di dua kali tidak menggandakan chip: index unik parsial
 * menolak baris kembar, dan penolakan itu diperlakukan sebagai keberhasilan.
 * `upsert` dengan `onConflict` tidak dipakai karena PostgREST harus menebak
 * index mana yang dimaksud, dan di sini ada DUA index unik parsial --
 * mention dengan kolom kosong tidak punya pasangan unik yang bisa disebut, jadi
 * tebakannya bisa meleset ke index yang salah.
 */
export async function addTodoMentions(
  input: { todoId: string; mentions: MentionInput[] },
): Promise<MentionResult<number>> {
  if (!input.todoId) return fail("ID tugas tidak valid");
  if (!Array.isArray(input.mentions) || input.mentions.length === 0) return fail("Tidak ada mention");

  const seen = new Set<string>();
  const rows = input.mentions
    .filter(
      (m) =>
        m && isUuid(m.id) && (m.kind === "customer" || m.kind === "servis") && isValidToken(m.token),
    )
    .filter((m) => {
      // Mention kembar di payload yang sama akan ditolak index unik dengan
      // error, dan seluruh insert gagal. Buang duplikatnya lebih dulu.
      const key = `${m.kind}:${m.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((m) => ({
      todo_id: input.todoId,
      token: m.token,
      customer_id: m.kind === "customer" ? m.id : null,
      servis_id: m.kind === "servis" ? m.id : null,
    }));

  if (rows.length === 0) return fail("Mention tidak valid");

  try {
    const { supabase } = await getContext();
    const { error } = await supabase.from("cervise_todo_mentions").insert(rows);
    if (error) {
      // 23505 = unique_violation: mention-nya sudah ada. Itu bukan kegagalan.
      if (error.code === "23505") return { ok: true, data: 0 };
      return fail(error.message);
    }
    return { ok: true, data: rows.length };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal menyimpan mention");
  }
}

export async function removeTodoMention(input: {
  mentionId: string;
}): Promise<MentionResult<null>> {
  if (!input.mentionId) return fail("Mention tidak valid");

  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("cervise_todo_mentions")
      .delete()
      .eq("id", input.mentionId);
    if (error) return fail(error.message);
    return { ok: true, data: null };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal menghapus mention");
  }
}
