const PER_PAGE = 1000;

/**
 * Cari user auth berdasarkan email, dengan meng-loop halaman.
 *
 * Kenapa tidak satu panggilan: `auth.admin.listUsers` tidak punya filter
 * email, dan hanya mengembalikan satu halaman per call. `createTenant` pernah
 * membaca 1000 user pertama lalu menyimpulkan emailnya belum ada; kalau email
 * itu ada di halaman 2, `createUser` gagal dengan "already registered" dan
 * tenant tidak bisa dibuat - padahal jalur "pakai akun yang sudah ada" justru
 * ada di file yang sama.
 *
 * Error dari Supabase diteruskan, bukan ditelan: pemanggil memakai hasilnya
 * untuk memutuskan create-atau-pakai, jadi `null` harus berarti "tidak ada",
 * bukan "tidak bisa cek".
 */
export async function findAuthUserByEmail(
  admin: {
    auth: {
      admin: {
        listUsers(args: { page: number; perPage: number }): Promise<{
          data: { users: { id: string; email?: string | null }[] } | null;
          error: { message: string } | null;
        }>;
      };
    };
  },
  email: string,
): Promise<{ id: string } | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    const found = users.find((user) => user.email?.toLowerCase() === target);
    if (found) return { id: found.id };
    if (users.length < PER_PAGE) return null;
  }
}