import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, upload, remove, cookiesSet, cookiesGet, revalidatePath, verifySessionMock } =
  vi.hoisted(() => {
    const rpc = vi.fn();
    const upload = vi.fn();
    const remove = vi.fn();
    const cookiesSet = vi.fn();
    const cookiesGet = vi.fn();
    return {
      rpc, upload, remove, cookiesSet, cookiesGet,
      revalidatePath: vi.fn(),
      verifySessionMock: vi.fn(),
    };
  });

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc, storage: { from: () => ({ upload, remove }) } }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookiesSet, get: cookiesGet }) }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/attendance/session", () => ({ verifySession: verifySessionMock, signSession: vi.fn(() => "token") }));
vi.mock("@/lib/attendance/pin", () => ({ validPin: (v: string) => /^\d{6}$/.test(v) }));

import { loginWithPin, readSession, submitKioskAttendance } from "./actions";

it("readSession returns null without a cookie even if the secret is not configured", async () => {
  delete process.env.ABSEN_SESSION_SECRET;
  cookiesGet.mockReturnValueOnce(undefined);
  await expect(readSession()).resolves.toBeNull();
});

function loginForm(email = "budi@kaggo.id", pin = "123456") {
  const f = new FormData();
  f.append("email", email);
  f.append("pin", pin);
  return f;
}

function absenForm(kind = "check_in") {
  const f = new FormData();
  f.append("kind", kind);
  f.append("selfie", new File([new Uint8Array(1024)], "selfie.jpg", { type: "image/jpeg" }));
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  cookiesGet.mockReturnValue({ value: "token" });
  process.env.ABSEN_SESSION_SECRET = "secret-tes";
  rpc.mockResolvedValue({ data: [{ employee_id: "emp-1", organization_id: "org-1", branch_id: "b-1", full_name: "Budi" }], error: null });
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  verifySessionMock.mockReturnValue({ employeeId: "emp-1", organizationId: "org-1", branchId: "b-1", name: "Budi", exp: Date.now() + 1000 });
});

describe("loginWithPin", () => {
  it("menolak PIN bukan 6 digit tanpa memanggil RPC", async () => {
    await expect(loginWithPin(loginForm("budi@kaggo.id", "abc"))).rejects.toThrow("PIN harus 6 digit angka");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("menolak email kosong", async () => {
    await expect(loginWithPin(loginForm("  ", "123456"))).rejects.toThrow("Email wajib");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("membuat cookie httpOnly setelah PIN valid", async () => {
    await loginWithPin(loginForm());
    expect(cookiesSet).toHaveBeenCalledWith("kaggo_absen_session", "token", expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }));
  });
});

describe("submitKioskAttendance", () => {
  it("memakai employee_id dari sesi, bukan dari FormData", async () => {
    const form = absenForm();
    form.append("employeeId", "emp-palsu");
    await submitKioskAttendance(form);
    expect(rpc).toHaveBeenCalledWith("submit_attendance_pin", expect.objectContaining({ p_employee_id: "emp-1" }));
  });
  it("menolak tanpa sesi", async () => {
    verifySessionMock.mockReturnValue(null);
    await expect(submitKioskAttendance(absenForm())).rejects.toThrow("Sesi berakhir");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("menganggap duplikat absen sebagai sukses (idempotent)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Sudah absen masuk hari ini" } });
    await expect(submitKioskAttendance(absenForm())).resolves.toEqual({ ok: true });
    expect(remove).not.toHaveBeenCalled();
  });
  it("menghapus foto yang terunggah saat RPC gagal dengan error lain", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Gagal menyimpan absen" } });
    await expect(submitKioskAttendance(absenForm())).rejects.toThrow("Gagal menyimpan absen");
    expect(remove).toHaveBeenCalledWith([expect.stringMatching(/^attendance\//)]);
  });
});
