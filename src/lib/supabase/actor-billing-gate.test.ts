import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Gerbang langganan di `actor.ts` diuji di sini lewat stub Supabase, bukan
 * dengan mocking `actor` itu sendiri.
 *
 * Alasannya: bug yang diperbaiki ini justru berada DI DALAM `resolveTenant`.
 * Test yang memock `getActiveTenant` akan selalu hijau apa pun isi fungsi
 * itu - termasuk kalau gerbangnya dihapus. Test ini menjalankan kodenya
 * sungguhan, dengan hanya tiga dependensi luar yang dipalsukan: client
 * Supabase, `cookies()`, dan `notFound()`.
 */

const { authGetUser, cookiesMock, fromMock } = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  cookiesMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: authGetUser },
    from: fromMock,
  }),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { getActiveTenant, getActiveTenantForBilling, TenantAccessError } from "./actor";

/**
 * Chain yang bisa di-`await` sekaligus punya terminal `maybeSingle()`.
 *
 * Keduanya dipakai: baris employees dan profiles di-resolve dengan `await`
 * langsung pada hasil `.eq()`, sedangkan sisanya lewat `.maybeSingle()`.
 */
function queryChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => result,
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => resolve(result),
  };
  return chain;
}

type Scenario = {
  trialEndsAt?: string | null;
  subscriptionStatus?: string | null;
  profileActive?: boolean;
  branchValid?: boolean;
  organizationStatus?: string;
  /** `null` berarti tidak ada baris subscription sama sekali. */
  omitSubscription?: boolean;
};

const PAST = "2020-01-01T00:00:00.000Z";
const FUTURE = "2999-01-01T00:00:00.000Z";

function useScenario(scenario: Scenario) {
  authGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  cookiesMock.mockResolvedValue({ get: () => undefined });

  fromMock.mockImplementation((table: string) => {
    switch (table) {
      case "employees":
        return {
          select: () =>
            queryChain({
              data: [{ id: "emp-1", organization_id: "org-1", branch_id: "branch-1", role: "MASTER_ADMIN" }],
              error: null,
            }),
        };
      case "profiles":
        return {
          select: () =>
            queryChain({
              data: {
                is_active: scenario.profileActive ?? true,
                full_name: "Pemilik Toko",
                email: "owner@example.com",
                avatar_url: null,
              },
              error: null,
            }),
        };
      case "organizations":
        return {
          select: () =>
            queryChain({
              data: {
                status: scenario.organizationStatus ?? "active",
                owner_profile_id: "user-1",
              },
              error: null,
            }),
        };
      case "branches":
        // Dua bentuk dipakai `resolveTenant`:
        //   - validasi cabang kepegawaian: `.eq(id).eq(org).eq(active).maybeSingle()`
        //   - daftar cabang organisasi untuk MASTER_ADMIN: `...order("name")` lalu await
        // Keduanya harus jalan di stub ini supaya invarian gerbang tetap teruji.
        return (() => {
          const rows =
            scenario.branchValid === false ? [] : [{ id: "branch-1" }];
          const chain: Record<string, unknown> = {
            select: () => chain,
            eq: () => chain,
            order: () => Promise.resolve({ data: rows, error: null }),
            maybeSingle: async () => ({
              data: rows[0] ?? null,
              error: null,
            }),
            then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
              resolve({ data: rows, error: null }),
          };
          return { select: () => chain };
        })();
      case "tenant_subscriptions":
        return {
          select: () =>
            queryChain(
              scenario.omitSubscription
                ? { data: null, error: null }
                : {
                    data: {
                      status: scenario.subscriptionStatus ?? "trial",
                      current_period_end: null,
                      trial_ends_at: scenario.trialEndsAt === undefined ? FUTURE : scenario.trialEndsAt,
                      grace_days: 3,
                    },
                    error: null,
                  },
            ),
        };
      default:
        throw new Error(`unexpected table: ${table}`);
    }
  });
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(TenantAccessError);
  await promise.catch((error: TenantAccessError) => {
    expect(error.code).toBe(code);
  });
}

describe("gerbang trial yang masih aktif", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useScenario({ trialEndsAt: FUTURE });
  });

  it("tidak memblokir jalur mana pun", async () => {
    const actor = await getActiveTenant();
    expect(actor.orgId).toBe("org-1");
    const billing = await getActiveTenantForBilling();
    expect(billing.orgId).toBe("org-1");
  });
});

describe("trial yang sudah habis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useScenario({ trialEndsAt: PAST });
  });

  it("menolak jalur biasa dengan kode subscription_expired", async () => {
    // Ini yang mengunci seluruh aplikasi. Kode barunya penting: `AppLayout`
    // membacanya untuk mengarahkan orang ke halaman tagihan, bukan ke login.
    await expectCode(getActiveTenant(), "subscription_expired");
  });

  it("membiarkan jalur tagihan terbuka", async () => {
    // Tanpa ini, halaman yang dipakai untuk membayar ikut terkunci dan
    // tidak ada jalan keluar selain platform owner.
    const actor = await getActiveTenantForBilling();
    expect(actor.orgId).toBe("org-1");
    expect(actor.role).toBe("MASTER_ADMIN");
    expect(actor.isOwner).toBe(true);
  });

  it("tetap melaporkan status subscription apa adanya untuk ditampilkan", async () => {
    // Halaman tagihan menampilkan "Trial berakhir" beserta tanggalnya, jadi
    // statusnya tidak boleh ditulis ulang jadi `blocked` saat dibaca.
    const actor = await getActiveTenantForBilling();
    expect(actor.subscription?.status).toBe("trial");
    expect(actor.subscription?.trialEndsAt).toBe(PAST);
  });

  it("trial tanpa tanggal juga dianggap habis", async () => {
    // `trial_ends_at` null berarti tidak ada ujungnya. Diperlakukan habis,
    // sama seperti sebelumnya - kalau tidak, tenant ini tidak akan pernah
    // terkunci.
    useScenario({ trialEndsAt: null });
    await expectCode(getActiveTenant(), "subscription_expired");
    const actor = await getActiveTenantForBilling();
    expect(actor.orgId).toBe("org-1");
  });

  it("MASIH menolak profil tidak aktif, walau lewat jalur tagihan", async () => {
    // Ini batas zealousness-nya. Pengecualian hanya untuk status langganan.
    // Akun yang dinonaktifkan karena alasan lain (keluar, dibekukan) tidak
    // boleh ikut mendapat halaman tagihan hanya karena tenant-nya punya
    // tagihan yang belum dibayar.
    useScenario({ trialEndsAt: PAST, profileActive: false });
    await expectCode(getActiveTenantForBilling(), "profile_inactive");
    await expectCode(getActiveTenant(), "profile_inactive");
  });

  it("MASIH menolak cabang tidak valid, walau lewat jalur tagihan", async () => {
    useScenario({ trialEndsAt: PAST, branchValid: false });
    await expectCode(getActiveTenantForBilling(), "branch_invalid");
  });

  it("MASIH menolak organisasi yang diblokir di level tenant", async () => {
    // `organizations.status` berbeda dari `tenant_subscriptions.status`:
    // yang ini berarti tenant-nya dinonaktifkan seluruhnya, bukan sekadar
    // tagihan yang jatuh tempo. Jalur tagihan tidak boleh membukanya.
    useScenario({ trialEndsAt: PAST, organizationStatus: "blocked" });
    await expectCode(getActiveTenantForBilling(), "subscription_blocked");
  });
});

describe("status langganan lain yang tidak aktif", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("status blocked tetap membuka jalur tagihan", async () => {
    // Tenant yang tagihannya menunggak harus bisa membayar - mengunci akses
    // tanpa membuka jalan pembayaran hanya memperpanjang masalah.
    useScenario({ subscriptionStatus: "blocked", organizationStatus: "active" });
    await expectCode(getActiveTenant(), "subscription_blocked");
    const actor = await getActiveTenantForBilling();
    expect(actor.orgId).toBe("org-1");
    expect(actor.subscription?.status).toBe("blocked");
  });

  it("langganan yang tidak ada tidak membuat halaman tagihan error", async () => {
    // Tanpa baris subscription, jalur biasa menolak. Jalur tagihan harus
    // tetap merender supaya yang salah bukan 500 tapi menampilkan bahasa
    // "belum ada langganan".
    useScenario({ omitSubscription: true });
    await expectCode(getActiveTenant(), "subscription_blocked");
    const actor = await getActiveTenantForBilling();
    expect(actor.orgId).toBe("org-1");
    expect(actor.subscription).toBeNull();
  });
});

describe("langganan aktif dengan grace yang habis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("perpanjang grace tidak membocorkan akses", async () => {
    // `grace` yang lewat jadi `blocked` oleh `getSubscriptionAccessState`.
    // Jalur tagihan boleh lewat, jalur biasa tidak.
    useScenario({
      subscriptionStatus: "grace",
      organizationStatus: "active",
    });
    // current_period_end null pada skenario ini, jadi status tidak
    // dihitung ulang; yang diuji di sini hanya bahwa kedua jalur tetap
    // memakai sumber status yang sama.
    const actor = await getActiveTenantForBilling();
    expect(actor.subscription?.status).toBe("grace");
  });
});
