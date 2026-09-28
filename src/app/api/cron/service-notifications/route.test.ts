import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    dispatchPendingNotifications: vi.fn(),
  },
}));

// Dispatcher di-mock, bukan Supabase atau Fonnte. Yang diuji di sini kontrak
// route-nya: auth, batas run, asal origin, dan status code saat dispatcher
// melempar. Perilaku dispatch sudah punya test-nya sendiri di dispatcher.test.ts.
vi.mock("@/lib/notifications/dispatcher", () => ({
  dispatchPendingNotifications: mocks.dispatchPendingNotifications,
}));

// `isAuthorizedCronRequest` sengaja TIDAK di-mock: itu fungsi murni tanpa
// dependency, dan mengujinya lewat `CRON_SECRET` asli membuat jalur auth yang
// benar-benar dipakai di produksi ikut teruji, bukan stub yang selalu bilang
// iya.
import { GET } from "./route";

const SECRET = "test-cron-secret";

/**
 * Default-nya meniru request dari Vercel: ada `Host`, dan reverse proxy
 * menaruh host publik + skema di `x-forwarded-*`. `authorization` ditambahkan
 * pemanggil yang butuh.
 */
function request(headers: Record<string, string> = {}) {
  return new Request("https://app.cervise.id/api/cron/service-notifications", {
    headers: {
      host: "app.cervise.id",
      "x-forwarded-proto": "https",
      ...headers,
    },
  });
}

function authorized(headers: Record<string, string> = {}) {
  return request({ authorization: `Bearer ${SECRET}`, ...headers });
}

describe("GET /api/cron/service-notifications", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
    // Dimulai dari "env origin tidak terisi" supaya setiap test benar-benar
    // menuruni cabang header, kecuali yang justru menguji env.
    delete process.env.NEXT_PUBLIC_SITE_URL;
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.dispatchPendingNotifications.mockResolvedValue({
      sent: 1,
      skipped: 0,
      failed: 0,
    });
  });

  afterEach(() => {
    consoleError.mockRestore();
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("menolak permintaan tanpa token cron", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mocks.dispatchPendingNotifications).not.toHaveBeenCalled();
  });

  it("menolak token yang salah", async () => {
    const response = await GET(request({ authorization: "Bearer salah" }));

    expect(response.status).toBe(401);
    expect(mocks.dispatchPendingNotifications).not.toHaveBeenCalled();
  });

  it("menjalankan dispatcher dan melaporkan hasilnya", async () => {
    const response = await GET(authorized());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sent: 1,
      skipped: 0,
      failed: 0,
    });
  });

  it("membatasi jumlah pesan per run", async () => {
    await GET(authorized());

    expect(mocks.dispatchPendingNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25 }),
    );
  });

  it("meneruskan hasil 'semua dilewati' apa adanya ke body respons", async () => {
    // `skipped` di sini berarti "tidak terkirim pada run ini" (mis. Fonnte
    // belum dikonfigurasi), bukan "selesai". Nilainya harus sampai ke log cron
    // apa adanya supaya operator bisa membedakan antrean yang mengalir dari
    // antrean yang macet karena token belum dipasang.
    mocks.dispatchPendingNotifications.mockResolvedValue({
      sent: 0,
      skipped: 25,
      failed: 0,
    });

    const response = await GET(authorized());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sent: 0,
      skipped: 25,
      failed: 0,
    });
  });

  it("mengembalikan 500 dan bukan 200 saat dispatcher melempar", async () => {
    // Regresi yang paling mungkin lolos: dispatcher melempar saat patch Supabase
    // gagal, route menjawab 200, dan cron terlihat sehat padahal tidak ada yang
    // terkirim. Barisnya masih pending di bawah lease, jadi tidak ada yang hilang
    // -- tapi kalau 200 yang tercatat, tidak ada alasan untuk melihat ke sini.
    mocks.dispatchPendingNotifications.mockRejectedValue(
      new Error("Patch baris 1a2b gagal: connection reset"),
    );

    const response = await GET(authorized());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty("error");
    // Isi error tidak ikut dikembalikan ke pemanggil: pesan dari Supabase bisa
    // memuat detail koneksi, dan response ini masuk log platform.
    expect(body).not.toHaveProperty("sent");
  });

  it("mencatat penyebab kegagalan ke log saat dispatcher melempar", async () => {
    mocks.dispatchPendingNotifications.mockRejectedValue(new Error("Klaim notifikasi gagal: timeout"));

    await GET(authorized());

    // Kegagalan yang tidak masuk log tidak bisa ditindaklanjuti.
    expect(consoleError).toHaveBeenCalled();
  });

  it("memberi dispatcher origin absolut dari header request", async () => {
    await GET(authorized());

    expect(mocks.dispatchPendingNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ siteOrigin: "https://app.cervise.id" }),
    );
  });

  it("menghormati x-forwarded-host dan x-forwarded-proto dari reverse proxy", async () => {
    await GET(
      authorized({
        host: "internal.local",
        "x-forwarded-host": "app.cervise.id",
        "x-forwarded-proto": "https",
      }),
    );

    expect(mocks.dispatchPendingNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ siteOrigin: "https://app.cervise.id" }),
    );
  });

  it("memakai http untuk localhost supaya dev lokal tidak menghasilkan tautan https", async () => {
    await GET(
      authorized({
        host: "localhost:3000",
        "x-forwarded-proto": "",
      }),
    );

    expect(mocks.dispatchPendingNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ siteOrigin: "http://localhost:3000" }),
    );
  });

  it("mendahulukan NEXT_PUBLIC_SITE_URL atas host deployment", async () => {
    // Tanpa ini, setiap preview deployment mengirim tautan ke domain preview-nya
    // sendiri, dan URL-nya mati begitu preview dihapus.
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.cervise.id/";

    await GET(authorized({ host: "cervise-abc123.vercel.app" }));

    expect(mocks.dispatchPendingNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ siteOrigin: "https://app.cervise.id" }),
    );
  });

  it("menolak run dan menjawab 500 saat origin tidak bisa ditentukan", async () => {
    // Dispatcher bisa jalan tanpa origin -- `service-message` lalu menghapus
    // baris "Cek status" dan tetap mengirim. Itu justru yang paling buruk:
    // pelanggan menerima pesan tanpa tautan, dan tidak ada yang gagal.
    const response = await GET(authorized({ host: "   " }));

    expect(response.status).toBe(500);
    expect(mocks.dispatchPendingNotifications).not.toHaveBeenCalled();
  });
});
