import { beforeEach, describe, expect, it, vi } from "vitest";

const { update, insert, deleteEq, deleteTable, selectEq, from, getActiveTenant, createAdminClient, revalidatePath } =
  vi.hoisted(() => {
    const update = vi.fn();
    const insert = vi.fn();
    const deleteEq = vi.fn();
    const selectEq = vi.fn();
    // `delete().eq().eq()` benar-benar berantai, jadi stub harus mendukungnya.
    const deleteTable: { eq: (col: string, val: string) => unknown } = { eq: deleteEq };
    deleteEq.mockReturnValue(deleteTable);
    const from = vi.fn(() => ({ update, insert, delete: () => deleteTable, select: () => ({ eq: selectEq }) }));
    return {
      update,
      insert,
      deleteEq,
      deleteTable,
      selectEq,
      from,
      getActiveTenant: vi.fn(),
      createAdminClient: vi.fn(() => ({ from })),
      revalidatePath: vi.fn(),
    };
  });

vi.mock("@/lib/supabase/actor", () => ({ getActiveTenant }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { deleteTestimonial, saveLacakBranding, saveTestimonial } from "./actions";

type Hasil = { data?: unknown; error: { message: string } | null };

function chain(result: Hasil) {
  const maybeSingle = () => Promise.resolve(result);
  const withEq = { select: () => ({ maybeSingle }) };
  return { eq: () => withEq, select: () => ({ maybeSingle }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  update.mockImplementation(() => chain({ data: { id: "org-1", slug: "pujon" }, error: null }));
  insert.mockResolvedValue({ error: null });
  deleteEq.mockReturnValue(deleteTable);
  from.mockReturnValue({ update, insert, delete: () => ({ eq: deleteEq }), select: () => ({ eq: selectEq }) });
  getActiveTenant.mockResolvedValue({ role: "MASTER_ADMIN", orgId: "org-1", branchId: "branch-1" });
});

function sebagaiRole(role: string) {
  getActiveTenant.mockResolvedValue({ role, orgId: "org-1", branchId: "branch-1" });
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
    });
  });

  it("menyimpan null saat tautan sosial dikosongkan", async () => {
    await saveLacakBranding({ tagline: "Halo", instagramUrl: "  ", tiktokUrl: "" });

    expect(update).toHaveBeenCalledWith({ tagline: "Halo", instagram_url: null, tiktok_url: null });
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

describe("saveTestimonial", () => {
  const valid = { nama: "Budi", isi: "Servis cepat.", rating: 5 as number | null, urutan: 0 };

  it("menolak role selain MASTER_ADMIN", async () => {
    sebagaiRole("ADMIN");

    await expect(saveTestimonial(valid)).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
  });

  it("menyimpan testimoni ke organisasi actor", async () => {
    await saveTestimonial(valid);

    expect(insert).toHaveBeenCalledWith({
      organization_id: "org-1",
      nama: "Budi",
      isi: "Servis cepat.",
      rating: 5,
      urutan: 0,
    });
  });

  it("menerima rating null untuk testimoni tanpa bintang", async () => {
    await saveTestimonial({ ...valid, rating: null });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ rating: null }));
  });

  it("menolak rating di luar 1-5", async () => {
    for (const rating of [0, 6, -1]) {
      await expect(saveTestimonial({ ...valid, rating })).rejects.toThrow();
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it("menolak nama atau isi kosong", async () => {
    await expect(saveTestimonial({ ...valid, nama: "  " })).rejects.toThrow();
    await expect(saveTestimonial({ ...valid, isi: "" })).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
  });

  it("memotong spasi di nama dan isi", async () => {
    await saveTestimonial({ ...valid, nama: " Budi ", isi: " Bagus " });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ nama: "Budi", isi: "Bagus" }));
  });
});

describe("deleteTestimonial", () => {
  it("menolak role selain MASTER_ADMIN", async () => {
    sebagaiRole("ADMIN");

    await expect(deleteTestimonial("t1")).rejects.toThrow();
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("membatasi delete ke tenant actor dan id yang diminta", async () => {
    await deleteTestimonial("t1");

    expect(deleteEq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(deleteEq).toHaveBeenCalledWith("id", "t1");
  });

  it("menolak id kosong", async () => {
    await expect(deleteTestimonial("   ")).rejects.toThrow();
    expect(deleteEq).not.toHaveBeenCalled();
  });
});