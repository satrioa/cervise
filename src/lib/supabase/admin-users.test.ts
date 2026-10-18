import { describe, expect, it, vi } from "vitest";
import { findAuthUserByEmail } from "./admin-users";

type ListUsers = (args: { page: number; perPage: number }) => Promise<{
  data: { users: { id: string; email?: string | null }[] } | null;
  error: { message: string } | null;
}>;

function fakeAdmin(listUsers: ListUsers) {
  return { auth: { admin: { listUsers } } } as never;
}

describe("findAuthUserByEmail", () => {
  it("mencari di semua halaman, bukan hanya halaman pertama", async () => {
    const listUsers = vi.fn<ListUsers>()
      .mockResolvedValueOnce({
        // Halaman penuh = 1000 user, jadi halaman berikutnya wajib diambil.
        data: { users: Array.from({ length: 1000 }, (_, index) => ({ id: `u${index}`, email: `u${index}@example.com` })) },
        error: null,
      })
      .mockResolvedValueOnce({ data: { users: [{ id: "b", email: "TARGET@example.com" }] }, error: null });

    await expect(findAuthUserByEmail(fakeAdmin(listUsers), "target@example.com")).resolves.toEqual({ id: "b" });
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it("berhenti setelah halaman yang tidak penuh", async () => {
    const listUsers = vi.fn<ListUsers>().mockResolvedValue({ data: { users: [{ id: "a", email: "x@example.com" }] }, error: null });
    await expect(findAuthUserByEmail(fakeAdmin(listUsers), "tidak-ada@example.com")).resolves.toBeNull();
    expect(listUsers).toHaveBeenCalledTimes(1);
  });

  it("mengembalikan null kalau tidak ada dan tidak meminta halaman tambahan", async () => {
    const listUsers = vi.fn<ListUsers>().mockResolvedValue({ data: { users: [] }, error: null });
    await expect(findAuthUserByEmail(fakeAdmin(listUsers), "x@example.com")).resolves.toBeNull();
    expect(listUsers).toHaveBeenCalledTimes(1);
  });

  it("mengembalikan null kalau tidak ada dan tidak meminta halaman tambahan", async () => {
    const listUsers = vi.fn<ListUsers>().mockResolvedValue({ data: { users: [] }, error: null });
    await expect(findAuthUserByEmail(fakeAdmin(listUsers), "x@example.com")).resolves.toBeNull();
    expect(listUsers).toHaveBeenCalledTimes(1);
  });

  it("tidak memanggil database untuk email kosong", async () => {
    const listUsers = vi.fn<ListUsers>();
    await expect(findAuthUserByEmail(fakeAdmin(listUsers), "   ")).resolves.toBeNull();
    expect(listUsers).not.toHaveBeenCalled();
  });

  it("melempar error Supabase, bukan menelan", async () => {
    const listUsers = vi.fn<ListUsers>().mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(findAuthUserByEmail(fakeAdmin(listUsers), "x@example.com")).rejects.toThrow("boom");
  });
});