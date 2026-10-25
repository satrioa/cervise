"use server";

import { getActiveTenant } from "@/lib/supabase/actor";
import { stripMentionTokens } from "@/lib/operational/mention-tokens";
import { loadTodos, toTodo, type TodoRow } from "@/lib/home/home-data";

/**
 * To-Do personal teknisi.
 *
 * RLS `cervise_staff_todos` sudah membatasi baris ke `employee_id = auth.uid()`
 * di policy select maupun write. Pemeriksaan di aplikasi tetap ada sebagai
 * defense lapis kedua dengan alasan berbeda: RLS menolak dengan pesan Postgres
 * yang tidak bisa dibaca pengguna, sedangkan di sini pesannya bisa.
 *
 * Judul boleh berisi token mention `{{m:k3f9a}}`. Panjang yang diukur
 * `cleanTitle` adalah teks yang TERLIHAT, bukan string mentah: check 200
 * karakter di database dihitung di atas string yang sudah berisi token, jadi
 * mengukurnya di sini juga akan menolak catatan yang isinya jelas-jelas
 * pendek. Batas pengaman di database sengaja lebih longgar (600) -- angka itu
 * hanya penangkap, aturannya di sini.
 */

export type StaffTodo = {
  id: string;
  title: string;
  dueAt: string | null;
  doneAt: string | null;
  createdAt: string;
};

/**
 * Kode kegagalan yang perlu	client membedakan.
 *
 * "not_found" berarti barisnya sudah tidak ada di server: sudah dihapus,
 * atau selesai pada hari sebelumnya lalu dibersihkan `loadTodos`. Client
 * HARUS menghapus baris itu dari daftar, bukan menampilkannya lagi - kalau
 * tidak, baris yang sudah tidak ada itu tetap terlihat dan setiap aksi
 * padanya berakhir dengan pesan yang sama, sehingga baris itu tidak pernah
 * bisa dihapus dari layar.
 */
export type TodoErrorCode = "not_found";

export type TodoResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: TodoErrorCode };

const TITLE_MIN = 1;
const TITLE_MAX = 600;
/** Batas teks yang terlihat pengguna. Batas kasar di bawah hanya pengaman. */
const TITLE_VISIBLE_MAX = 200;

function fail<T>(error: string, code?: TodoErrorCode): TodoResult<T> {
  return code ? { ok: false, error, code } : { ok: false, error };
}

function cleanTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < TITLE_MIN) return null;
  if (trimmed.length > TITLE_MAX) return null;
  if (stripMentionTokens(trimmed).trim().length > TITLE_VISIBLE_MAX) return null;
  return trimmed;
}

async function getTodoContext() {
  const actor = await getActiveTenant();
  if (!actor.branchId) throw new Error("Cabang belum ditetapkan untuk akun ini");
  return { supabase: actor.supabase, branchId: actor.branchId, userId: actor.userId, role: actor.role };
}

/**
 * Baris To-Do milik pengguna ini saja.
 *
 * Selesai hari ini tetap ikut agar bisa dibatalkan; yang selesai sebelum hari
 * ini dibersihkan oleh loader (`loadTodos`).
 *
 * Pemuatan barisnya ada di `@/lib/home/home-data` supaya Home bisa memakai
 * loader yang sama tanpa me-resolve aktor dua kali.
 */
export async function getMyTodos(): Promise<TodoResult<StaffTodo[]>> {
  try {
    return { ok: true, data: await loadTodos(await getTodoContext()) };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal memuat daftar tugas");
  }
}

export async function createTodo(input: {
  title: string;
  dueAt?: string | null;
}): Promise<TodoResult<StaffTodo>> {
  const title = cleanTitle(input.title);
  if (!title) return fail("Judul tugas wajib diisi");

  try {
    const { supabase, branchId, userId } = await getTodoContext();
    const { data, error } = await supabase
      .from("cervise_staff_todos")
      .insert({ employee_id: userId, branch_id: branchId, title, due_at: input.dueAt ?? null })
      .select("id, title, due_at, done_at, created_at")
      .single();

    if (error) return fail(error.message);
    return { ok: true, data: toTodo(data as TodoRow) };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal menambah tugas");
  }
}

export async function updateTodo(input: {
  id: string;
  title?: string;
  dueAt?: string | null;
}): Promise<TodoResult<StaffTodo>> {
  if (!input.id) return fail("ID tugas tidak valid");

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = cleanTitle(input.title);
    if (!title) return fail("Judul tugas wajib diisi");
    patch.title = title;
  }
  if (input.dueAt !== undefined) patch.due_at = input.dueAt;

  if (Object.keys(patch).length === 0) return fail("Tidak ada perubahan yang dikirim");

  try {
    const { supabase, userId } = await getTodoContext();
    const { data, error } = await supabase
      .from("cervise_staff_todos")
      .update(patch)
      .eq("id", input.id)
      .eq("employee_id", userId)
      .select("id, title, due_at, done_at, created_at")
      .maybeSingle();

    if (error) return fail(error.message);
    if (!data) return fail("Tugas tidak ditemukan", "not_found");
    return { ok: true, data: toTodo(data as TodoRow) };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal menyimpan tugas");
  }
}

export async function toggleTodo(input: {
  id: string;
  done: boolean;
}): Promise<TodoResult<{ id: string; doneAt: string | null }>> {
  if (!input.id) return fail("ID tugas tidak valid");

  try {
    const { supabase, userId } = await getTodoContext();
    const { data, error } = await supabase
      .from("cervise_staff_todos")
      .update({ done_at: input.done ? new Date().toISOString() : null })
      .eq("id", input.id)
      .eq("employee_id", userId)
      .select("id, done_at")
      .maybeSingle();

    if (error) return fail(error.message);
    if (!data) return fail("Tugas tidak ditemukan", "not_found");
    return {
      ok: true,
      data: { id: (data as { id: string }).id, doneAt: (data as { done_at: string | null }).done_at },
    };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal mengubah status tugas");
  }
}

export async function deleteTodo(input: { id: string }): Promise<TodoResult<null>> {
  if (!input.id) return fail("ID tugas tidak valid");

  try {
    const { supabase, userId } = await getTodoContext();
    const { data, error } = await supabase
      .from("cervise_staff_todos")
      .delete()
      .eq("id", input.id)
      .eq("employee_id", userId)
      .select("id")
      .maybeSingle();

    if (error) return fail(error.message);
    if (!data) return fail("Tugas tidak ditemukan", "not_found");
    return { ok: true, data: null };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal menghapus tugas");
  }
}
