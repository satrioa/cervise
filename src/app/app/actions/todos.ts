"use server";

import { getActiveTenant } from "@/lib/supabase/actor";

/**
 * To-Do personal teknisi.
 *
 * RLS `cervise_staff_todos` sudah membatasi baris ke `employee_id = auth.uid()`
 * di policy select maupun write. Pemeriksaan di aplikasi tetap ada sebagai
 * defense lapis kedua dengan alasan berbeda: RLS menolak dengan pesan Postgres
 * yang tidak bisa dibaca pengguna, sedangkan di sini pesannya bisa.
 */

export type StaffTodo = {
  id: string;
  title: string;
  dueAt: string | null;
  doneAt: string | null;
  createdAt: string;
};

export type TodoResult<T> = { ok: true; data: T } | { ok: false; error: string };

const TITLE_MIN = 1;
const TITLE_MAX = 200;

function fail<T>(error: string): TodoResult<T> {
  return { ok: false, error };
}

function cleanTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < TITLE_MIN || trimmed.length > TITLE_MAX) return null;
  return trimmed;
}

type TodoRow = {
  id: string;
  title: string;
  due_at: string | null;
  done_at: string | null;
  created_at: string;
};

function toTodo(row: TodoRow): StaffTodo {
  return {
    id: row.id,
    title: row.title,
    dueAt: row.due_at,
    doneAt: row.done_at,
    createdAt: row.created_at,
  };
}

async function getTodoContext() {
  const actor = await getActiveTenant();
  if (!actor.branchId) throw new Error("Cabang belum ditetapkan untuk akun ini");
  return { supabase: actor.supabase, branchId: actor.branchId, userId: actor.userId };
}

/** Baris To-Do milik pengguna ini saja. Selesai tetap ikut agar bisa dibatalkan. */
export async function getMyTodos(): Promise<TodoResult<StaffTodo[]>> {
  try {
    const { supabase, userId } = await getTodoContext();
    const { data, error } = await supabase
      .from("cervise_staff_todos")
      .select("id, title, due_at, done_at, created_at")
      .eq("employee_id", userId)
      .order("done_at", { ascending: true, nullsFirst: false })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) return fail(error.message);
    return { ok: true, data: ((data ?? []) as TodoRow[]).map(toTodo) };
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
    if (!data) return fail("Tugas tidak ditemukan");
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
    if (!data) return fail("Tugas tidak ditemukan");
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
    if (!data) return fail("Tugas tidak ditemukan");
    return { ok: true, data: null };
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : "Gagal menghapus tugas");
  }
}
