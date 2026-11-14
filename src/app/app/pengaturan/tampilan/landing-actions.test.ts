import { beforeEach, describe, expect, it, vi } from "vitest";

const { update, upload, remove, selectEq, from, storageFrom, getActiveTenant, createAdminClient, revalidatePath } =
  vi.hoisted(() => {
    const update = vi.fn();
    const upload = vi.fn();
    const remove = vi.fn();
    const selectEq = vi.fn();
    const from = vi.fn(() => ({ update, select: () => ({ eq: selectEq }) }));
    const storageFrom = vi.fn(() => ({ upload, remove }));
    return {
      update,
      upload,
      remove,
      selectEq,
      from,
      storageFrom,
      getActiveTenant: vi.fn(),
      createAdminClient: vi.fn(() => ({ from, storage: { from: storageFrom } })),
      revalidatePath: vi.fn(),
    };
  });

vi.mock("@/lib/supabase/actor", () => ({ getActiveTenant }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { removeLacakBanner, saveLacakBranding, uploadLacakBanner } from "./actions";

const BANNER_A = "tenant-logos/org-1/aaaaaaaaaaaaaaaaaaaaaaaa.png";
const BANNER_B = "tenant-logos/org-1/bbbbbbbbbbbbbbbbbbbbbbbb.png";
const BANNER_C = "tenant-logos/org-1/cccccccccccccccccccccccc.png";

beforeEach(() => {
  vi.clearAllMocks();
  update.mockImplementation(() => ({ eq: () => Promise.resolve({ error: null }) }));
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  selectEq.mockReturnValue({ maybeSingle: () => Promise.resolve({ data: { banner_urls: [] }, error: null }) });
  getActiveTenant.mockResolvedValue({ role: "MASTER_ADMIN", orgId: "org-1", branchId: "branch-1" });
});

function sebagaiRole(role: string) {
  getActiveTenant.mockResolvedValue({ role, orgId: "org-1", branchId: "branch-1" });
}

function bannerTersimpan(paths: string[]) {
  selectEq.mockReturnValue({ maybeSingle: () => Promise.resolve({ data: { banner_urls: paths }, error: null }) });
}

function formBanner(index: number) {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(1024)], "banner.png", { type: "image/png" }));
  form.append("index", String(index));
  return form;
}

describe("saveLacakBranding", () => {
  const input = {
    tagline: "Servis Gadget Ter-murah",
    instagramUrl: "https://instagram.com/jcellular.id",
    tiktokUrl: "https://tiktok.com/@jcellular",
  };

  it("menolak role selain MASTER_ADMIN tanpa menulis", async () => {
    for (const role of ["ADMIN", "FRONTLINER", "TECHNICIAN"]) {
      sebagaiRole(role);
      await expect(saveLacakBranding(input)).rejects.toThrow();
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("menyimpan tagline dan kedua tautan sosial", async () => {
    await saveLacakBranding(input);

    expect(update).toHaveBeenCalledWith({
      tagline: "Servis Gadget Ter-murah",
      instagram_url: "https://instagram.com/jcellular.id",
      tiktok_url: "https://tiktok.com/@jcellular",
      website_url: null,
      facebook_url: null,
      x_url: null,
      youtube_url: null,
      whatsapp_url: null,
      maps_url: null,
      footer_note: null,
    });
  });

  it("menyimpan null saat tautan sosial dikosongkan", async () => {
    await saveLacakBranding({ tagline: "Halo", instagramUrl: "  ", tiktokUrl: "" });

    expect(update).toHaveBeenCalledWith({ tagline: "Halo", instagram_url: null, tiktok_url: null, website_url: null, facebook_url: null, x_url: null, youtube_url: null, whatsapp_url: null, maps_url: null, footer_note: null });
  });

  it("menolak tautan sosial dengan skema berbahaya", async () => {
    await expect(
      saveLacakBranding({ ...input, instagramUrl: "javascript:alert(1)" }),
    ).rejects.toThrow(/instagram/i);
    expect(update).not.toHaveBeenCalled();
  });

  it("memotong spasi di tagline", async () => {
    await saveLacakBranding({ ...input, tagline: "   Halo   " });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ tagline: "Halo" }));
  });

  it("membatasi panjang tagline", async () => {
    await expect(saveLacakBranding({ ...input, tagline: "x".repeat(200) })).rejects.toThrow();
  });

  it("menerima tagline kosong", async () => {
    await saveLacakBranding({ ...input, tagline: "   " });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ tagline: null }));
  });
});

describe("uploadLacakBanner", () => {
  it("menolak role selain MASTER_ADMIN", async () => {
    sebagaiRole("ADMIN");

    await expect(uploadLacakBanner(formBanner(0))).rejects.toThrow();
    expect(upload).not.toHaveBeenCalled();
  });

  it("mengisi slot pertama lalu menyimpan satu path", async () => {
    await uploadLacakBanner(formBanner(0));

    const dikirim = update.mock.calls[0][0] as { banner_urls: string[] };
    expect(dikirim.banner_urls).toHaveLength(1);
    expect(dikirim.banner_urls[0]).toMatch(/^tenant-logos\/org-1\/[a-z0-9]+\.png$/);
  });

  it("menolak slot yang melompati slot sebelumnya", async () => {
    await expect(uploadLacakBanner(formBanner(2))).rejects.toThrow(/slot pertama/);
    expect(upload).not.toHaveBeenCalled();
  });

  it("mengganti isi slot dan menghapus objek lama", async () => {
    bannerTersimpan([BANNER_A, BANNER_B]);

    await uploadLacakBanner(formBanner(0));

    const dikirim = update.mock.calls[0][0] as { banner_urls: string[] };
    expect(dikirim.banner_urls).toHaveLength(2);
    expect(dikirim.banner_urls[0]).not.toBe(BANNER_A);
    expect(dikirim.banner_urls[1]).toBe(BANNER_B);
    expect(remove).toHaveBeenCalledWith([BANNER_A]);
  });

  it("menolak slot di luar rentang 0-2", async () => {
    await expect(uploadLacakBanner(formBanner(3))).rejects.toThrow(/tidak valid/);
  });
});

describe("removeLacakBanner", () => {
  it("menolak role selain MASTER_ADMIN", async () => {
    sebagaiRole("ADMIN");

    await expect(removeLacakBanner(0)).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });

  it("membuang slot yang diminta dan menghapus objeknya", async () => {
    bannerTersimpan([BANNER_A, BANNER_B, BANNER_C]);

    await removeLacakBanner(1);

    expect(update).toHaveBeenCalledWith({ banner_urls: [BANNER_A, BANNER_C] });
    expect(remove).toHaveBeenCalledWith([BANNER_B]);
  });

  it("menolak slot di luar rentang 0-2", async () => {
    await expect(removeLacakBanner(3)).rejects.toThrow(/tidak valid/);
  });
});
