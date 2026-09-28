import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: string;
  servis_id: string | null;
  event: "servis_created" | "servis_status";
  to_kind: string;
  to_status: string | null;
  attempts: number;
};

const { mocks, state, FakeFonnteError } = vi.hoisted(() => {
  const s = {
    claimed: [] as Record<string, unknown>[],
    servis: [] as Record<string, unknown>[],
    customers: [] as Record<string, unknown>[],
    profiles: [] as Record<string, unknown>[],
    patches: [] as { id: string; patch: Record<string, unknown> }[],
    rpcCalls: [] as { fn: string; args: unknown }[],
    rpcError: null as { message: string } | null,
    fetchErrors: {} as Record<string, { message: string }>,
    patchThrows: [] as string[],
    patchError: null as { id: string; message: string } | null,
    selects: [] as { table: string; columns: string }[],
  };

  /**
   * Cermin persis `FonnteError` dari src/lib/fonnte.ts: konstruktornya
   * `(reason, scope)` dan `retryable` diturunkan dari `scope`.
   *
   * Dua cacat di brief sudah diperbaiki di sini:
   *
   * 1. Versi brief punya konstruktor `(reason, retryable, scope)` sementara
   *    semua call site hanya mengoper dua argumen, jadi `scope` selalu
   *    `undefined`. Dispatcher yang memeriksa `error.scope === "message"` tidak
   *    pernah melihatnya sebagai terminal.
   * 2. Kelas harus DI DALAM `vi.hoisted`. Factory `vi.mock` di-hoist ke paling
   *    atas berkas, di atas deklarasi kelas tingkat modul, jadi kelas yang
   *    dideklarasikan di luar `hoisted` belum terinisialisasi saat factory
   *    dijalankan -- seluruh berkas gagal dimuat, bukan cuma satu test.
   */
  class FakeFonnteError extends Error {
    readonly reason: string;
    readonly scope: "message" | "infrastructure";
    readonly retryable: boolean;

    constructor(reason: string, scope: "message" | "infrastructure") {
      super(`Fonnte gagal: ${reason}`);
      this.name = "FonnteError";
      this.reason = reason;
      this.scope = scope;
      this.retryable = scope !== "message";
    }
  }

  return {
    state: s,
    FakeFonnteError,
    mocks: {
      createAdminClient: vi.fn(),
      sendFonnteWA: vi.fn(),
    },
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

// Dispatcher memeriksa `error instanceof FonnteError`. Kalau kelas yang di-mock
// berbeda dari kelas yang dipakai di test, `instanceof` selalu false dan error
// yang sebenarnya permanen akan ikut di-retry.
vi.mock("@/lib/fonnte", () => ({
  sendFonnteWA: mocks.sendFonnteWA,
  FonnteError: FakeFonnteError,
}));

import { dispatchPendingNotifications } from "./dispatcher";

const SERVIS = {
  id: "s1",
  service_number: "SRV-2026-0012",
  device: "Xiaomi Redmi 13C",
  complaint: "Layar pecah",
  tracking_code: "F5FB0DFCB6",
  status: "Masuk",
  customer_id: "c1",
  teknisi_id: null,
  branches: {
    organization_id: "o1",
    organizations: { name: "Servisin", slug: "servisin" },
  },
};

const ORIGIN = "https://app.cervise.id";

/**
 * `.eq()` mengembalikan objek yang bisa di-await, seperti PostgrestFilterBuilder
 * yang sesungguhnya. Stub brief mengembalikan `{ select }` -- objek biasa yang
 * `await` hanya meneruskannya tanpa menjalankan apa pun, jadi `error` hasil
 * patch tidak pernah bisa dibaca dan test apa pun yang memeriksanya hijau di
 * atas kode yang tidak erred sama sekali.
 */
function stubAdmin() {
  return {
    rpc: async (fn: string, args: unknown) => {
      state.rpcCalls.push({ fn, args });
      return { data: state.claimed, error: state.rpcError };
    },
    from: (table: string) => {
      if (table === "cervise_notification_outbox") {
        return {
          update: (patch: Record<string, unknown>) => ({
            eq: (_col: string, id: string) => {
              if (state.patchThrows.includes(id)) {
                throw new Error(`patch gagal untuk ${id}`);
              }
              state.patches.push({ id, patch });
              const error = state.patchError?.id === id ? state.patchError : null;
              return Promise.resolve({ data: [{ id }], error });
            },
          }),
        };
      }

      const data =
        table === "cervise_services"
          ? state.servis
          : table === "cervise_customers"
            ? state.customers
            : table === "profiles"
              ? state.profiles
              : null;

      if (data === null) throw new Error(`tabel tak terduga: ${table}`);

      return {
        select: (columns: string) => {
          state.selects.push({ table, columns });
          return {
            in: async () => ({ data, error: state.fetchErrors[table] ?? null }),
          };
        },
      };
    },
  };
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: "o1",
    servis_id: "s1",
    event: "servis_created",
    to_kind: "customer",
    to_status: null,
    attempts: 0,
    ...overrides,
  };
}

function patchFor(id: string): Record<string, unknown> {
  const found = state.patches.find((entry) => entry.id === id);
  if (!found) throw new Error(`tidak ada patch untuk ${id}: ${JSON.stringify(state.patches)}`);
  return found.patch;
}

function profile(
  phone: string | null,
  employees: { organization_id: string; is_active: boolean }[] = [],
) {
  return { id: "p1", phone, employees };
}

describe("dispatchPendingNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.claimed = [];
    state.servis = [];
    state.customers = [];
    state.profiles = [];
    state.patches = [];
    state.rpcCalls = [];
    state.rpcError = null;
    state.fetchErrors = {};
    state.patchThrows = [];
    state.patchError = null;
    state.selects = [];
    mocks.createAdminClient.mockReturnValue(stubAdmin());
    mocks.sendFonnteWA.mockResolvedValue({ skip: false, status: true, detail: {} });
  });

  describe("klaim", () => {
    it("tidak mengirim apa pun dan tidak melempar saat antrean kosong", async () => {
      const result = await dispatchPendingNotifications();

      expect(result).toEqual({ sent: 0, skipped: 0, failed: 0 });
      expect(state.rpcCalls).toEqual([
        { fn: "claim_service_notifications", args: { p_limit: 25 } },
      ]);
      expect(mocks.sendFonnteWA).not.toHaveBeenCalled();
    });

    it("membatasi jumlah baris sesuai limit", async () => {
      await dispatchPendingNotifications({ limit: 2 });
      expect(state.rpcCalls[0].args).toEqual({ p_limit: 2 });
    });

    it("melempar saat klaim gagal, bukan melaporkan nol", async () => {
      // Kembalikan nol membuat route menjawab 200 dengan antrean kosong
      // antreannya justru rusak. Barisnya masih pending dan akan diambil lagi,
      // jadi melempar di sini hanya membuat kegagalannya terlihat.
      state.rpcError = { message: "koneksi ke database putus" };

      await expect(dispatchPendingNotifications()).rejects.toThrow();
      expect(mocks.sendFonnteWA).not.toHaveBeenCalled();
    });

    it("melempar saat salah satu pengambilan data gagal, tanpa menandai baris", async () => {
      // Kalau error diabaikan, `servisById` kosong dan SETIAP baris salah
      // didiagnosis `servis_not_found` lalu jadi failed permanen. Satu kedipan
      // jaringan akan membuang 25 notifikasi yang sebenarnya masih layak.
      state.claimed = [row()];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      state.fetchErrors.cervise_services = { message: "statement timeout" };

      await expect(dispatchPendingNotifications({ siteOrigin: ORIGIN })).rejects.toThrow();
      expect(state.patches).toEqual([]);
      expect(mocks.sendFonnteWA).not.toHaveBeenCalled();
    });
  });

  describe("pengiriman", () => {
    it("mengirim ke customer dalam bentuk 62 dan menandai terkirim", async () => {
      state.claimed = [row()];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "081234567890" }];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.sent).toBe(1);
      expect(mocks.sendFonnteWA).toHaveBeenCalledWith(
        "6281234567890",
        expect.stringContaining("F5FB0DFCB6"),
        "62",
      );
      expect(patchFor("o1")).toMatchObject({ state: "sent", last_error: null });
    });

    it("mengisi provider_message_id supaya rekonsiliasi sisi provider mungkin", async () => {
      // Tanpa ini, kolom yang dibuat Task 7 selamanya NULL dan tidak ada cara
      // mencocokkan baris outbox dengan pesan yang benar-benar ada di Fonnte.
      state.claimed = [row()];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      mocks.sendFonnteWA.mockResolvedValue({
        skip: false,
        status: true,
        detail: { id: "abc", detail: { id: "wm-77123" } },
      });

      await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(patchFor("o1").provider_message_id).toBe("wm-77123");
    });

    it("menulis provider_message_id null tanpa menggagalkan kirim saat bentuknya berbeda", async () => {
      // Fonnte versi berikutnya boleh mengubah bentuk payload. Menolak
      // pengiriman karena ID tidak terbaca akan jauh lebih buruk daripada
      // kehilangan ID yang hanya berguna untuk rekonsiliasi.
      state.claimed = [row()];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      mocks.sendFonnteWA.mockResolvedValue({
        skip: false,
        status: true,
        detail: { status: true },
      });

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.sent).toBe(1);
      expect(patchFor("o1")).toMatchObject({
        state: "sent",
        provider_message_id: null,
      });
    });

    it("mengubah id numerik dari Fonnte menjadi teks", async () => {
      state.claimed = [row()];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      mocks.sendFonnteWA.mockResolvedValue({
        skip: false,
        status: true,
        detail: { detail: { id: 12345 } },
      });

      await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(patchFor("o1").provider_message_id).toBe("12345");
    });

    it("mengirim pesan status ke customer memakai status yang diantrekan", async () => {
      state.claimed = [row({ event: "servis_status", to_status: "Selesai" })];
      // Servis sudah lanjut ke "Sudah Diambil" sejak pesan diantrekan. Yang
      // dibaca harus `to_status`, bukan status terkini, supaya pelanggan tidak
      // diberi tahu "Selesai" untuk servis yang sudah diambil.
      state.servis = [{ ...SERVIS, status: "Sudah Diambil" }];
      state.customers = [{ id: "c1", phone: "628123456789" }];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.sent).toBe(1);
      expect(mocks.sendFonnteWA).toHaveBeenCalledWith(
        "628123456789",
        expect.stringContaining("Selesai"),
        "62",
      );
    });

    it("tidak menulis sent_at pada baris yang tidak benar-benar terkirim", async () => {
      // `sent_at` berarti "pesan terkirim". Menuliskannya pada baris yang
      // dilewati membuat kolom itu berbohong, dan tidak ada yang membacanya
      // sekarang -- jadi tidak ada yang akan marbrekan bohong itu nanti.
      state.claimed = [row()];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "0812" }];

      await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(patchFor("o1")).not.toHaveProperty("sent_at");
    });
  });

  describe("penerima yang tidak bisa dihubungi", () => {
    it("menggagalkan nomor customer yang tidak bisa dikirim, tanpa retry", async () => {
      state.claimed = [row()];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "0812" }];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result).toEqual({ sent: 0, skipped: 0, failed: 1 });
      expect(mocks.sendFonnteWA).not.toHaveBeenCalled();
      expect(patchFor("o1")).toMatchObject({ state: "failed", last_error: "no_phone" });
    });

    it("menggagalkan teknisi yang tidak punya nomor, tanpa retry", async () => {
      // `profiles.phone` nullable, jadi ini keadaan normal -- bukan kegagalan.
      // Tapi tetap harus terminal: pesan "servis baru masuk" sudah basi begitu
      // teknisi selesai mengerjakannya, dan mencoba lagi hanya membakar anggaran
      // percobaan untuk jawaban yang sama.
      state.claimed = [row({ to_kind: "technician" })];
      state.servis = [{ ...SERVIS, teknisi_id: "p1" }];
      state.profiles = [profile(null, [{ organization_id: "o1", is_active: true }])];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result).toEqual({ sent: 0, skipped: 0, failed: 1 });
      expect(mocks.sendFonnteWA).not.toHaveBeenCalled();
      expect(patchFor("o1")).toMatchObject({ state: "failed", last_error: "no_phone" });
    });

    it("tidak menambah attempts pada baris yang gagal di sebelum kirim", async () => {
      // `attempts` menghitung pengiriman nyata. Baris yang tidak pernah
      // dikirim tidak menambahnya, kalau tidak anggaran percobaan habis tanpa
      // satu pun pesan benar-benar mencoba dikirim.
      state.claimed = [row({ attempts: 2 })];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "0812" }];

      await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(patchFor("o1")).not.toHaveProperty("attempts");
    });

    it("menggagalkan pelanggan yang tidak ditemukan", async () => {
      state.claimed = [row()];
      state.servis = [SERVIS];
      state.customers = [];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result).toEqual({ sent: 0, skipped: 0, failed: 1 });
      expect(patchFor("o1")).toMatchObject({
        state: "failed",
        last_error: "customer_not_found",
      });
    });

    it("menggagalkan servis tanpa customer_id", async () => {
      // customer_id nullable dan `on delete set null`, jadi ini reachable:
      // pelanggan dihapus setelah servis dibuat.
      state.claimed = [row()];
      state.servis = [{ ...SERVIS, customer_id: null }];
      state.customers = [{ id: "c1", phone: "628123456789" }];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.failed).toBe(1);
      expect(patchFor("o1")).toMatchObject({
        state: "failed",
        last_error: "customer_not_found",
      });
    });

    it("menggagalkan servis yang sudah dihapus tanpa melempar", async () => {
      // `servis_id` sengaja tidak punya FK supaya riwayat pengiriman bertahan
      // setelah servis dihapus. Konsekuensinya baris yatim itu wajar, dan tidak
      // akan pernah bisa dikirim -- jadi terminal, bukan error.
      state.claimed = [row()];
      state.servis = [];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result).toEqual({ sent: 0, skipped: 0, failed: 1 });
      expect(patchFor("o1")).toMatchObject({
        state: "failed",
        last_error: "servis_not_found",
      });
    });

    it("menggagalkan servic yang tidak punya servis_id sama sekali", async () => {
      state.claimed = [row({ servis_id: null })];
      state.servis = [SERVIS];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.failed).toBe(1);
      expect(patchFor("o1")).toMatchObject({
        state: "failed",
        last_error: "servis_not_found",
      });
    });
  });

  describe("teknisi", () => {
    it("mengirim ke teknisi dengan baris employees aktif di organisasi yang sama", async () => {
      state.claimed = [row({ to_kind: "technician" })];
      state.servis = [{ ...SERVIS, teknisi_id: "p1" }];
      state.profiles = [profile("628999999999", [{ organization_id: "o1", is_active: true }])];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.sent).toBe(1);
      expect(mocks.sendFonnteWA).toHaveBeenCalledWith(
        "628999999999",
        expect.stringContaining("SRV-2026-0012"),
        "62",
      );
    });

    it("menggagalkan teknisi yang dinonaktifkan", async () => {
      state.claimed = [row({ to_kind: "technician" })];
      state.servis = [{ ...SERVIS, teknisi_id: "p1" }];
      state.profiles = [
        profile("628999999999", [{ organization_id: "o1", is_active: false }]),
      ];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result).toEqual({ sent: 0, skipped: 0, failed: 1 });
      expect(mocks.sendFonnteWA).not.toHaveBeenCalled();
      expect(patchFor("o1")).toMatchObject({
        state: "failed",
        last_error: "technician_inactive",
      });
    });

    it("menggagalkan teknisi yang tidak punya baris employees sama sekali", async () => {
      state.claimed = [row({ to_kind: "technician" })];
      state.servis = [{ ...SERVIS, teknisi_id: "p1" }];
      state.profiles = [profile("628999999999", [])];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.failed).toBe(1);
      expect(patchFor("o1")).toMatchObject({
        state: "failed",
        last_error: "technician_inactive",
      });
    });

    it("menggagalkan teknisi yang hanya aktif di organisasi lain", async () => {
      // Karyawan bisa punya baris employees di beberapa organisasi. Kalau yang
      // dicek hanya `is_active`, teknisi yang sudah dinonaktifkan di tenant yang
      // memiliki servis ini tetap menerima detail servis tenant lain.
      state.claimed = [row({ to_kind: "technician" })];
      state.servis = [{ ...SERVIS, teknisi_id: "p1" }];
      state.profiles = [
        profile("628999999999", [
          { organization_id: "o-other", is_active: true },
          { organization_id: "o1", is_active: false },
        ]),
      ];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.failed).toBe(1);
      expect(mocks.sendFonnteWA).not.toHaveBeenCalled();
      expect(patchFor("o1")).toMatchObject({
        state: "failed",
        last_error: "technician_inactive",
      });
    });

    it("menggagalkan servis yang belum punya teknisi", async () => {
      // Trigger menotifikasi teknisi saat INSERT, dan servis yang baru dibuat
      // hampir selalu belum punya teknisi. Pesan "servis baru masuk" untuk
      // servis yang sudah lama dikerjakan tidak berguna, jadi jangan diulang.
      state.claimed = [row({ to_kind: "technician" })];
      state.servis = [{ ...SERVIS, teknisi_id: null }];
      state.profiles = [profile("628999999999", [{ organization_id: "o1", is_active: true }])];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.failed).toBe(1);
      expect(patchFor("o1")).toMatchObject({
        state: "failed",
        last_error: "technician_not_found",
      });
    });

    it("menggagalkan baris teknisi untuk perubahan status, bukan mengirim pesan masuk", async () => {
      // Trigger hanya membuat baris teknisi untuk `servis_created`, dan tidak
      // ada builder status untuk teknisi. Kalau kombinasi ini tetap diteruskan,
      // teknisi akan menerima "Servis baru masuk" untuk perubahan status.
      state.claimed = [row({ to_kind: "technician", event: "servis_status", to_status: "Selesai" })];
      state.servis = [{ ...SERVIS, teknisi_id: "p1", status: "Selesai" }];
      state.profiles = [profile("628999999999", [{ organization_id: "o1", is_active: true }])];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.failed).toBe(1);
      expect(mocks.sendFonnteWA).not.toHaveBeenCalled();
      expect(patchFor("o1")).toMatchObject({
        state: "failed",
        last_error: "unsupported_technician_event",
      });
    });
  });

  describe("penerima yang tidak dikenal", () => {
    it("menggagalkan baris dengan to_kind yang tidak dikenal", async () => {
      // Versi brief memfilter to_kind yang asing diam-diam, jadi barisnya tetap
      // pending dan diambil ulang setiap lease -- satu baris yang tidak pernah
      // selesai dan tidak pernah tercatat.
      state.claimed = [row({ to_kind: "manager" })];
      state.servis = [SERVIS];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.failed).toBe(1);
      expect(patchFor("o1")).toMatchObject({
        state: "failed",
        last_error: "unsupported_recipient",
      });
    });
  });

  describe("retry", () => {
    it("menunda dengan backoff saat error yang bisa dicoba lagi", async () => {
      state.claimed = [row({ attempts: 1 })];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      mocks.sendFonnteWA.mockRejectedValue(
        new FakeFonnteError("insufficient quota", "infrastructure"),
      );

      const now = new Date("2026-09-27T10:00:00.000Z");
      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN, now });

      expect(result.failed).toBe(1);
      const patch = patchFor("o1");
      expect(patch.state).toBe("pending");
      expect(patch.last_error).toBe("insufficient quota");
      expect(new Date(patch.next_attempt_at as string).getTime()).toBeGreaterThan(now.getTime());
    });

    it("menunda dengan backoff saat token ditolak, bukan membuang pesan", async () => {
      // Satu token dipakai semua tenant, jadi token kedaluwarsa membalas 401
      // untuk setiap pesan sekaligus. Kalau ini jadi terminal, satu rotasi
      // token membuang semua notifikasi tanpa jejak. Pesannya sendiri masih layak.
      state.claimed = [row({ attempts: 1 })];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      mocks.sendFonnteWA.mockRejectedValue(
        new FakeFonnteError("HTTP 401", "infrastructure"),
      );

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.failed).toBe(1);
      expect(patchFor("o1")).toMatchObject({ state: "pending", last_error: "HTTP 401" });
    });

    it("berhenti retry setelah empat percobaan", async () => {
      state.claimed = [row({ attempts: 3 })];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      mocks.sendFonnteWA.mockRejectedValue(
        new FakeFonnteError("insufficient quota", "infrastructure"),
      );

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.failed).toBe(1);
      expect(patchFor("o1")).toMatchObject({ state: "failed" });
    });

    it("tidak mengulang error yang memang soal pesan", async () => {
      state.claimed = [row({ attempts: 1 })];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      mocks.sendFonnteWA.mockRejectedValue(new FakeFonnteError("invalid target", "message"));

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.failed).toBe(1);
      expect(patchFor("o1")).toMatchObject({
        state: "failed",
        last_error: "invalid target",
      });
    });

    it("memperlakukan error yang tidak dikenal sebagai sementara", async () => {
      // `instanceof FonnteError` false untuk apa pun yang lain, termasuk bug di
      // kode ini sendiri. Perlakukan sebagai terminal akan membuang notifikasi
      // karena kesalahan yang tidak ada hubungannya dengan pesannya.
      state.claimed = [row({ attempts: 0 })];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      mocks.sendFonnteWA.mockRejectedValue(new TypeError("undefined is not a function"));

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.failed).toBe(1);
      const patch = patchFor("o1");
      expect(patch.state).toBe("pending");
      expect(patch.last_error).toContain("undefined is not a function");
    });

    it("menambah attempts hanya sekali per pengiriman dan menyimpannya", async () => {
      // Ini yang membuat MAX_ATTEMPTS bekerja sama sekali. Kalau attempts tidak
      // ditulis balik, selalu 0 di database, `row.attempts + 1` selalu 1, dan
      // syarat `attempts >= 4` tidak pernah tercapai: satu pesan yang selalu
      // gagal akan mencoba selamanya.
      state.claimed = [row({ attempts: 0 })];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      mocks.sendFonnteWA.mockRejectedValue(
        new FakeFonnteError("insufficient quota", "infrastructure"),
      );

      await dispatchPendingNotifications({ siteOrigin: ORIGIN });
      expect(patchFor("o1").attempts).toBe(1);

      // Percobaan kedua, dengan nilai yang benar-benar dikembalikan database.
      state.patches = [];
      state.claimed = [row({ attempts: 1 })];
      await dispatchPendingNotifications({ siteOrigin: ORIGIN });
      expect(patchFor("o1").attempts).toBe(2);
    });

    it("menyimpan attempts juga saat pengiriman berhasil", async () => {
      // attempts berarti "jumlah pengiriman nyata". Kalau tidak ditulis di jalur
      // sukses, kolomnya hanya mencerminkan kondisi gagal saja.
      state.claimed = [row({ attempts: 1 })];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];

      await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(patchFor("o1").attempts).toBe(2);
    });

    it("melewati cron run berikutnya setelah anggaran percobaan habis", async () => {
      // Keempat percobaan sudah terjadi di run sebelumnya. Dengan attempts yang
      // benar-benar ditulis, baris ini tidak lagi pending dan tidak akan pernah
      // diklaim lagi.
      state.claimed = [row({ attempts: 4 })];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      mocks.sendFonnteWA.mockRejectedValue(
        new FakeFonnteError("insufficient quota", "infrastructure"),
      );

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.failed).toBe(1);
      expect(patchFor("o1")).toMatchObject({ state: "failed", attempts: 5 });
    });
  });

  describe("Fonnte belum dikonfigurasi", () => {
    it("menunda baris, tidak menghapusnya, dan tidak menambah attempts", async () => {
      // `skip` berarti FONNTE_TOKEN belum ada: keadaan yang disengaja, bukan
      // error. Tidak ada permintaan yang keluar, jadi tidak ada percobaan kirim
      // yang perlu dihitung.
      state.claimed = [row({ attempts: 2 })];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      mocks.sendFonnteWA.mockResolvedValue({ skip: true });

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      // Penghitung `skipped` tetap berarti satu hal saja: tidak dikirim pada run
      // ini karena Fonnte belum dikonfigurasi.
      expect(result).toEqual({ sent: 0, skipped: 1, failed: 0 });
      const patch = patchFor("o1");
      expect(patch).toMatchObject({
        state: "pending",
        last_error: "fonnte_not_configured",
      });
      expect(patch).not.toHaveProperty("attempts");
    });

    it("tidak pernah menulis state terminal untuk Fonnte yang belum dikonfigurasi", async () => {
      // Regression guard untuk kehilangan data yang tidak bisa dipulihkan.
      // 'skipped' tidak akan pernah dipilih lagi oleh claim (yang hanya
      // mengambil state = 'pending') dan dedupe_key-nya sudah terpakai di
      // enqueue dengan on conflict do nothing -- jadi satu tick tanpa
      // FONNTE_TOKEN akan menghapus antrean secara permanen, dan memasang
      // token belakangan tidak memulihkan apa pun.
      state.claimed = [row({ attempts: 0 })];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      mocks.sendFonnteWA.mockResolvedValue({ skip: true });

      await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      const patch = patchFor("o1");
      expect(patch.state).not.toBe("skipped");
      expect(patch.state).not.toBe("failed");
      // Dan harus ada jadwal ulang, kalau tidak barisnya due terus-menerus.
      expect(new Date(patch.next_attempt_at as string).getTime()).toBeGreaterThan(
        Date.now() + 60_000,
      );
    });
  });

  describe("isolasi antar baris", () => {
    it("tetap memproses baris berikutnya ketika satu baris melempar", async () => {
      // Klaim sudah menyewa seluruh baris. Kalau try/catch dipasang di luar
      // loop, satu baris beracun memblokir semua baris di belakangnya dan
      // semuanya menunggu lease penuh tanpa alasan.
      state.claimed = [
        row({ id: "o1" }),
        row({ id: "o2" }),
        row({ id: "o3" }),
      ];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      state.patchThrows = ["o1"];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result).toEqual({ sent: 2, skipped: 0, failed: 1 });
      expect(patchFor("o2")).toMatchObject({ state: "sent" });
      expect(patchFor("o3")).toMatchObject({ state: "sent" });
    });

    it("tetap memproses baris berikutnya ketika pengiriman melempar", async () => {
      state.claimed = [row({ id: "o1" }), row({ id: "o2" })];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      mocks.sendFonnteWA
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce({ skip: false, status: true, detail: {} });

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result).toEqual({ sent: 1, skipped: 0, failed: 1 });
      expect(patchFor("o2")).toMatchObject({ state: "sent" });
    });

    it("tidak melapor terkirim kalau penulisan statusnya gagal", async () => {
      // Baris tetap pending, jadi akan dikirim lagi. Melaporkan `sent` membuat
      // cron log berdusta dan menutup satu-satunya jejak masalahnya.
      state.claimed = [row()];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      state.patchError = { id: "o1", message: "deadlock terdeteksi" };

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result).toEqual({ sent: 0, skipped: 0, failed: 1 });
    });

    it("menjumlahkan ketiga penghitung sama dengan baris yang diproses", async () => {
      // Kalau tidak, cron log tidak bisa dipakai: `failed` yang terlalu besar
      // atau terlalu kecil tanpa ada yang bisa Dicocokkan.
      state.claimed = [
        row({ id: "o1" }),
        row({ id: "o2" }),
        row({ id: "o3" }),
        row({ id: "o4" }),
      ];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];
      mocks.sendFonnteWA.mockImplementation(async (target: string) =>
        target === "628999999999" ? { skip: true } : { skip: false, status: true, detail: {} },
      );
      state.patchThrows = ["o4"];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.sent + result.skipped + result.failed).toBe(4);
    });
  });

  describe("bentuk kueri", () => {
    /**
     * PERINGATAN: ini test STRUKTURAL, bukan perilaku. Stub di atas tidak
     * meniru penyaringan PostgREST, jadi `!inner` yang ditambahkan ke select
     * tidak mengubah apa pun yang terlihat di test lain -- mutasi `!inner`
     * survived kalau test ini tidak ada.
     *
     * Yang dilindungi nyata: `branches.organization_id` nullable dan
     * `employees` one-to-many. `!inner` membuang baris yang tidak punya relasi,
     * sehingga servis tanpa organisasi hilang dari hasil dan barisnya salah
     * didiagnosis `servis_not_found` lalu jadi failed permanen, dan teknisi
     * tanpa baris employees hilang sehingga `technician_inactive` tidak pernah
     * tercapai.
     */
    it("tidak memakai !inner pada embed yang nullable", async () => {
      state.claimed = [row({ to_kind: "technician" })];
      state.servis = [{ ...SERVIS, teknisi_id: "p1" }];
      state.profiles = [profile("628999999999", [{ organization_id: "o1", is_active: true }])];

      await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(state.selects.length).toBeGreaterThan(0);
      for (const { table, columns } of state.selects) {
        expect({ table, hasInnerJoin: columns.includes("!inner") }).toEqual({
          table,
          hasInnerJoin: false,
        });
      }
    });
  });

  describe("pengambilan data", () => {
    it("mengambil satu servis per baris, bukan satu per baris", async () => {
      state.claimed = [row({ id: "o1" }), row({ id: "o2" })];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.sent).toBe(2);
    });

    it("bekerja tanpa siteOrigin dan tidak melempar tautan menggantung", async () => {
      // siteOrigin datang dari env yang belum tentu terisi. Builder Task 6 sudah
      // menangani asal kosong; dispatcher tidak boleh crash di sini.
      state.claimed = [row()];
      state.servis = [SERVIS];
      state.customers = [{ id: "c1", phone: "628123456789" }];

      const result = await dispatchPendingNotifications();

      expect(result.sent).toBe(1);
      const message = mocks.sendFonnteWA.mock.calls[0][1] as string;
      expect(message).not.toContain("undefined");
      expect(message).not.toContain("/lacak/");
    });

    it("memakai nama toko dari cabang, dan tidak pernah mengarangnya", async () => {
      // `branches.organization_id` nullable, jadi `organizations` bisa null.
      // Select `!inner` akan menghilangkan servis seperti ini dari hasil --
      // barisnya lalu salah didiagnosis `servis_not_found` dan jadi failed
      // permanen, padahal servisnya ada.
      state.claimed = [row()];
      state.servis = [{ ...SERVIS, branches: { organization_id: null, organizations: null } }];
      state.customers = [{ id: "c1", phone: "628123456789" }];

      const result = await dispatchPendingNotifications({ siteOrigin: ORIGIN });

      expect(result.sent).toBe(1);
      const message = mocks.sendFonnteWA.mock.calls[0][1] as string;
      expect(message).toContain("Servis diterima");
      expect(message).not.toContain("Cervise -");
    });
  });
});
