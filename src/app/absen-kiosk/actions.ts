"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHOTO_BUCKET, attendancePhotoPath, isSafeObjectPath, validatePhotoFile } from "@/lib/photos";
import { wibDate } from "@/lib/attendance/status";
import { validPin } from "@/lib/attendance/pin";
import { signSession, verifySession, type SessionPayload } from "@/lib/attendance/session";

const COOKIE_NAME = "kaggo_absen_session";
const TWELVE_HOURS = 12 * 60 * 60;

function secret(): string {
  const value = process.env.ABSEN_SESSION_SECRET;
  if (!value) throw new Error("ABSEN_SESSION_SECRET belum dikonfigurasi");
  return value;
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(COOKIE_NAME)?.value, secret());
}

export async function loginWithPin(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const pin = String(formData.get("pin") ?? "").trim();
  if (!email) throw new Error("Email wajib");
  if (!validPin(pin)) throw new Error("PIN harus 6 digit angka");

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_employee_pin", { p_email: email, p_pin: pin });
  if (error || !data?.length) throw new Error(error?.message ?? "Email atau PIN salah");

  const row = data[0] as {
    employee_id: string;
    organization_id: string;
    branch_id: string | null;
    full_name: string | null;
  };
  const token = signSession({
    employeeId: row.employee_id,
    organizationId: row.organization_id,
    branchId: row.branch_id,
    name: row.full_name ?? "Karyawan",
    exp: Date.now() + TWELVE_HOURS * 1000,
  }, secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TWELVE_HOURS,
  });
  revalidatePath("/absen-kiosk");
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function submitKioskAttendance(formData: FormData): Promise<{ ok: true }> {
  const session = await readSession();
  if (!session) throw new Error("Sesi berakhir. Silakan masuk lagi.");

  const kind = formData.get("kind");
  if (kind !== "check_in" && kind !== "check_out") throw new Error("Jenis absen tidak valid");
  const selfie = formData.get("selfie");
  if (!(selfie instanceof File) || selfie.size === 0) throw new Error("Selfie wajib diisi");
  const validation = validatePhotoFile(selfie);
  if (!validation.ok) throw new Error(validation.error);

  const admin = createAdminClient();
  const path = attendancePhotoPath(
    session.organizationId,
    session.employeeId,
    wibDate(new Date()),
    kind === "check_in" ? "in" : "out",
    validation.extension,
  );
  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, selfie, { contentType: selfie.type, upsert: false });
  if (uploadError) throw new Error(`Gagal mengunggah selfie: ${uploadError.message}`);

  const note = formData.get("note");
  const { error } = await admin.rpc("submit_attendance_pin", {
    p_employee_id: session.employeeId,
    p_kind: kind,
    p_selfie_path: path,
    p_lat: numberOrNull(formData.get("lat")),
    p_lng: numberOrNull(formData.get("lng")),
    p_note: typeof note === "string" ? note : null,
  });
  if (error) {
    // Klik dua kali / refresh saat baris sudah ada bukan kegagalan: kondisi
    // akhir yang diinginkan sudah tercapai, jadi jangan lempar React error.
    const sudahTercatat =
      error.message === "Sudah absen masuk hari ini" ||
      error.message === "Belum absen masuk atau sudah absen pulang hari ini";
    if (!sudahTercatat) {
      if (isSafeObjectPath(path)) await admin.storage.from(PHOTO_BUCKET).remove([path]);
      throw new Error(error.message);
    }
  }

  revalidatePath("/absen-kiosk");
  return { ok: true };
}
