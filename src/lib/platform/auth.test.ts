import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Dua kondisi yang sebelumnya tercampur jadi satu di requirePlatformAdmin:
 * user yang belum login, dan user yang sudah login tapi bukan staff platform.
 *
 * Keduanya dulu diarahkan ke /login. Akibatnya MASTER_ADMIN tenant - yang
 * sebenarnya sedang login dan aksesnya ke /owner memang memang tidak ada -
 * melihat layar login dan mengira sesinya habis. Diuji terpisah supaya
 * pemisahan itu tidak collapses lagi.
 */

// vi.mock di-hoist ke atas file, jadi factory-nya dieksekusi sebelum const di
// bawah diinisialisasi. vi.hoisted membuat ketiga deklarasi ini ikut ter-hoist.
const { getUserMock, adminQueryMock, redirectMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  adminQueryMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: adminQueryMock,
  }),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { requirePlatformAdmin } from "./auth";

/** Membangun rantai query `.from().select().eq().eq().maybeSingle()`. */
function stubAdminLookup(result: { data: unknown; error: unknown }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => result,
  };
  adminQueryMock.mockReturnValue(chain);
  return chain;
}

/**
 * redirect() melempar, dan karena requirePlatformAdmin async, yang melempar
 * adalah rejected promise - bukan throw sinkron. Jadi harus di-await.
 */
async function expectRedirect(url: string) {
  await expect(requirePlatformAdmin()).rejects.toThrow(`NEXT_REDIRECT:${url}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email: "a@b.c" } } });
  stubAdminLookup({ data: null, error: null });
});

describe("requirePlatformAdmin saat user SUDAH login tapi bukan platform admin", () => {
  it("mengembalikan ke /app, bukan ke layar login", async () => {
    // Inilah bug yang dilaporkan: user aktif%, lalu diklik "Buat Tenant Baru",
    // lalu dikira logout.
    await expectRedirect("/app?error=platform-admin-required");
  });

  it("tidak mengirim next=/owner, karena user tidak punya akses ke sana", async () => {
    // Kalau next ikut dibawa, login berikutnya akan memantulkan dia tepat ke
    // halaman yang baru saja menolaknya.
    await requirePlatformAdmin().catch((error: unknown) => {
      expect(String(error)).not.toContain("next=");
    });
  });
});

describe("requirePlatformAdmin saat user belum login", () => {
  beforeEach(() => {
    getUserMock.mockResolvedValue({ data: { user: null } });
  });

  it("tetap ke /login dengan next, karena itu memang satu-satunya jalan masuk", async () => {
    // Pintu /owner tidak boleh bocor hanya karena perbaikannya di atas.
    await expectRedirect("/login?next=/owner");
  });
});

describe("requirePlatformAdmin saat user adalah platform admin", () => {
  it("mengembalikan actor dan tidak redirect sama sekali", async () => {
    stubAdminLookup({ data: { profile_id: "user-1", role: "owner" }, error: null });
    const actor = await requirePlatformAdmin();
    expect(actor.userId).toBe("user-1");
    expect(actor.role).toBe("owner");
  });

  it("melempar error kalau pengecekan platform_admins gagal, bukan diam-diam lewat", async () => {
    stubAdminLookup({ data: null, error: { message: "boom" } });
    await expect(requirePlatformAdmin()).rejects.toThrow("Gagal memverifikasi akses platform admin");
  });
});
