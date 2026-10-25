import { beforeEach, describe, expect, it, vi } from "vitest";

const { mocks } = vi.hoisted(() => {
  const from = vi.fn();
  const getActiveTenant = vi.fn();
  return { mocks: { from, getActiveTenant } };
});

vi.mock("@/lib/supabase/actor", () => ({ getActiveTenant: mocks.getActiveTenant }));

import { createTodo, deleteTodo, getMyTodos, toggleTodo, updateTodo } from "./todos";

/**
 * Rantai query Supabase untuk tabel To-Do.
 *
 * `single()` dan `maybeSingle()` mengembalikan hasil yang sudah disiapkan,
 * jadi test bisa menelusuri sampai ke "baris tidak ditemukan" tanpa
 * database.
 */
function chain(result: { data: unknown; error: { message: string } | null }) {
  const query: Record<string, unknown> = {};
  query.insert = vi.fn(() => query);
  query.update = vi.fn(() => query);
  query.delete = vi.fn(() => query);
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.single = vi.fn(async () => result);
  query.maybeSingle = vi.fn(async () => result);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

const ROW = {
  id: "todo-1",
  title: "Cek Kerusakan",
  due_at: null,
  done_at: null,
  created_at: "2026-10-25T07:00:00.000Z",
};

describe("aksi To-Do", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue(chain({ data: null, error: null }));
    mocks.getActiveTenant.mockResolvedValue({
      supabase: { from: mocks.from },
      userId: "user-1",
      orgId: "org-1",
      branchId: "branch-1",
      employeeId: "employee-1",
      role: "FRONTLINER",
      subscription: null,
    });
  });

  describe("baris yang sudah tidak ada", () => {
    // Baris yang dihapus di server (mis. tugas selesai yang dibersihkan
    // `loadTodos`, atau dihapus dari perangkat lain) masih bisa tampil di
    // kartu yang belum mengsinkronkan daftarnya. Aksi atas baris seperti itu
    // SELALU gagal. Kalau hasilnya tidak ditandai, client salah mengira
    // kegagalannya berarti ada masalah dan mengembalikan baris yang sudah
    // dihapus - sehingga baris itu tidak akan pernah bisa dihapus.
    it("update menandai hasilnya sebagai not_found", async () => {
      const result = await updateTodo({ id: "todo-1", title: "Cek Kerusakan" });

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.code).toBe("not_found");
    });

    it("toggle menandai hasilnya sebagai not_found", async () => {
      const result = await toggleTodo({ id: "todo-1", done: true });

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.code).toBe("not_found");
    });

    it("delete menandai hasilnya sebagai not_found", async () => {
      const result = await deleteTodo({ id: "todo-1" });

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.code).toBe("not_found");
    });

    it("kegagalan lain tidak ditandai sebagai not_found", async () => {
      mocks.from.mockReturnValue(chain({ data: null, error: { message: "boom" } }));

      const result = await updateTodo({ id: "todo-1", title: "Cek Kerusakan" });

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.code).toBeUndefined();
      expect(result.ok === false && result.error).toBe("boom");
    });
  });

  describe("baris yang masih ada", () => {
    it("update mengembalikan baris yang tersimpan", async () => {
      mocks.from.mockReturnValue(chain({ data: ROW, error: null }));

      const result = await updateTodo({ id: "todo-1", title: "Cek Kerusakan" });

      expect(result.ok).toBe(true);
      expect(result.ok === true && result.data).toMatchObject({ id: "todo-1" });
    });

    it("toggle mengembalikan status baru", async () => {
      mocks.from.mockReturnValue(chain({ data: { id: "todo-1", done_at: "2026-10-25T08:00:00Z" }, error: null }));

      const result = await toggleTodo({ id: "todo-1", done: true });

      expect(result.ok).toBe(true);
      expect(result.ok === true && result.data.doneAt).toBe("2026-10-25T08:00:00Z");
    });

    it("delete mengembalikan hasil tanpa error", async () => {
      mocks.from.mockReturnValue(chain({ data: { id: "todo-1" }, error: null }));

      const result = await deleteTodo({ id: "todo-1" });

      expect(result.ok).toBe(true);
      expect(result.ok === true && result.data).toBe(null);
    });

    it("create menyimpan baris baru", async () => {
      mocks.from.mockReturnValue(chain({ data: ROW, error: null }));

      const result = await createTodo({ title: "Cek Kerusakan" });

      expect(result.ok).toBe(true);
      expect(result.ok === true && result.data).toMatchObject({ id: "todo-1" });
    });
  });

  it("daftar dimuat hanya untuk akun yang sedang masuk", async () => {
    mocks.from.mockReturnValue(chain({ data: [ROW], error: null }));

    const result = await getMyTodos();

    expect(result.ok).toBe(true);
    expect(mocks.from).toHaveBeenCalledWith("cervise_staff_todos");
  });
});
