import { beforeEach, describe, expect, it, vi } from "vitest";

const { update, from, getActiveTenant, createAdminClient, revalidatePath } = vi.hoisted(() => {
  const update = vi.fn();
  const from = vi.fn(() => ({ update }));
  return {
    update,
    from,
    getActiveTenant: vi.fn(),
    createAdminClient: vi.fn(() => ({ from })),
    revalidatePath: vi.fn(),
  };
});

vi.mock("@/lib/supabase/actor", () => ({ getActiveTenant }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { saveLacakAppearance } from "./actions";

function chain(result: { data?: unknown; error: { message: string } | null }) {
  const maybeSingle = () => Promise.resolve(result);
  const withEq = { select: () => ({ maybeSingle }) };
  return { eq: () => withEq, select: () => ({ maybeSingle }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  update.mockImplementation(() => chain({ data: { id: "org-1", slug: "pujon" }, error: null }));
  from.mockReturnValue({ update });
  getActiveTenant.mockResolvedValue({ role: "MASTER_ADMIN", orgId: "org-1", branchId: "branch-1" });
});

describe("saveLacakAppearance", () => {
  it("menolak role selain MASTER_ADMIN tanpa menyentuh database", async () => {
    getActiveTenant.mockResolvedValue({ role: "ADMIN", orgId: "org-1", branchId: "branch-1" });

    await expect(
      saveLacakAppearance({ mode: "dark", palette: "indigo", density: "compact", font: "inter" }),
    ).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });

  it("menolak FRONTLINER dan TECHNICIAN", async () => {
    for (const role of ["FRONTLINER", "TECHNICIAN"]) {
      getActiveTenant.mockResolvedValue({ role, orgId: "org-1", branchId: "branch-1" });
      await expect(
        saveLacakAppearance({ mode: "dark", palette: "indigo", density: "compact", font: "inter" }),
      ).rejects.toThrow();
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("menyimpan keempat pilihan ke organizations milik actor", async () => {
    await saveLacakAppearance({ mode: "dark", palette: "indigo", density: "compact", font: "inter" });

    expect(update).toHaveBeenCalledWith({
      lacak_appearance: { mode: "dark", palette: "indigo", density: "compact", font: "inter" },
    });
  });

  it("mengganti nilai ngawur dengan default, bukan menyimpan apa adanya", async () => {
    await saveLacakAppearance({
      mode: "ngawur",
      palette: ["indigo"] as never,
      density: "1px" as never,
      font: "url(x)" as never,
    });

    expect(update).toHaveBeenCalledWith({
      lacak_appearance: { mode: "system", palette: "graphite", density: "cozy", font: "geist" },
    });
  });

  it("membuang kunci asing dari payload", async () => {
    await saveLacakAppearance({
      mode: "light",
      palette: "graphite",
      density: "cozy",
      font: "geist",
      __proto__: { mode: "dark" },
    } as never);

    const tersimpan = update.mock.calls[0][0].lacak_appearance;
    expect(Object.keys(tersimpan).sort()).toEqual(["density", "font", "mode", "palette"]);
  });

  it("menyegarkan halaman Lacak publik supaya pelanggan langsung melihat perubahan", async () => {
    revalidatePath.mockReturnValue(undefined as never);

    await saveLacakAppearance({ mode: "dark", palette: "indigo", density: "compact", font: "inter" });

    const paths = revalidatePath.mock.calls.map((call) => call[0] as string);
    expect(paths.some((p) => p.includes("/lacak"))).toBe(true);
  });

  it("menyebugkan error dari database apa adanya", async () => {
    update.mockImplementation(() => chain({ error: { message: "permission denied" } }));

    await expect(
      saveLacakAppearance({ mode: "dark", palette: "indigo", density: "compact", font: "inter" }),
    ).rejects.toThrow(/permission denied/);
  });

  it("melempar error kalau organisasi tidak ada", async () => {
    update.mockImplementation(() => chain({ data: null, error: null }));

    await expect(
      saveLacakAppearance({ mode: "dark", palette: "indigo", density: "compact", font: "inter" }),
    ).rejects.toThrow();
  });
});
