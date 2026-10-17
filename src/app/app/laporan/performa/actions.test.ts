import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPerformaTeknisi } from "./actions";

const { from, getActiveTenant } = vi.hoisted(() => ({
  from: vi.fn(),
  getActiveTenant: vi.fn(),
}));

vi.mock("@/lib/supabase/actor", () => ({ getActiveTenant }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

function actor(role: string) {
  return {
    supabase: { from },
    userId: "user-1",
    branchId: "branch-1",
    role,
    orgId: "org-1",
  };
}

describe("getPerformaTeknisi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Server action bisa dipanggil langsung, jadi guard di page.tsx tidak
  // menutup jalur ini. Teknisi tidak boleh membaca tabel KPI teknisi.
  it("menolak role yang tidak punya akses ke laporan performa", async () => {
    getActiveTenant.mockResolvedValue(actor("TECHNICIAN"));

    const result = await getPerformaTeknisi();

    expect(result.error).toContain("tidak diizinkan");
    expect(from).not.toHaveBeenCalled();
  });

  it("tetap membaca data untuk kasir", async () => {
    getActiveTenant.mockResolvedValue(actor("FRONTLINER"));
    // Rantai query yang selalu kembali ke dirinya sendiri, lalu resolve kosong.
    const chain: any = {};
    for (const method of ["eq", "order", "not", "is", "in", "gte", "lt", "limit"]) {
      chain[method] = () => chain;
    }
    chain.then = (resolve: any) => resolve({ data: [], error: null });
    from.mockReturnValue({ select: () => chain });

    const result = await getPerformaTeknisi();

    expect(result.error).toBeNull();
    expect(from).toHaveBeenCalled();
  });
});