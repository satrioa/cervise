import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, upload, remove, getActiveTenantForAttendance, createAdminClient, revalidatePath } =
  vi.hoisted(() => {
    const rpc = vi.fn();
    const upload = vi.fn();
    const remove = vi.fn();
    return {
      rpc,
      upload,
      remove,
      getActiveTenantForAttendance: vi.fn(),
      createAdminClient: vi.fn(() => ({ storage: { from: () => ({ upload, remove }) } })),
      revalidatePath: vi.fn(),
    };
  });

vi.mock("@/lib/supabase/actor", () => ({ getActiveTenantForAttendance }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { submitAttendance } from "./actions";

function form(kind = "check_in") {
  const data = new FormData();
  data.append("kind", kind);
  data.append("selfie", new File([new Uint8Array(1024)], "selfie.jpg", { type: "image/jpeg" }));
  data.append("lat", "-6.2");
  data.append("lng", "106.8");
  data.append("note", "macet");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  getActiveTenantForAttendance.mockResolvedValue({
    orgId: "org-1", branchId: "branch-1", employeeId: "emp-1", supabase: { rpc },
  });
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ data: { id: "row-1" }, error: null });
});

describe("submitAttendance", () => {
  it("memakai identitas actor, bukan id dari klien", async () => {
    const data = form();
    data.append("organization_id", "org-palsu");
    data.append("employee_id", "emp-palsu");
    await submitAttendance(data);
    expect(rpc).toHaveBeenCalledWith("submit_attendance", expect.objectContaining({ p_kind: "check_in" }));
    expect(upload.mock.calls[0][0]).toMatch(/^attendance\/org-1\/emp-1\//);
  });

  it("menolak kind selain check_in/check_out sebelum upload", async () => {
    await expect(submitAttendance(form("hack"))).rejects.toThrow("Jenis absen tidak valid");
    expect(upload).not.toHaveBeenCalled();
  });

  it("menolak tanpa selfie", async () => {
    const data = new FormData();
    data.append("kind", "check_in");
    await expect(submitAttendance(data)).rejects.toThrow("Foto selfie wajib");
    expect(upload).not.toHaveBeenCalled();
  });

  it("menghapus foto yang sudah terunggah kalau RPC gagal", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Sudah absen masuk hari ini" } });
    await expect(submitAttendance(form())).rejects.toThrow("Sudah absen masuk hari ini");
    expect(remove).toHaveBeenCalledWith([expect.stringMatching(/^attendance\//)]);
  });

  it("mengembalikan ok setelah RPC sukses", async () => {
    await expect(submitAttendance(form("check_out"))).resolves.toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/absensi");
    expect(revalidatePath).toHaveBeenCalledWith("/app/laporan/absensi");
  });
});
