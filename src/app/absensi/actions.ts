"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenantForAttendance } from "@/lib/supabase/actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHOTO_BUCKET, attendancePhotoPath, isSafeObjectPath, validatePhotoFile } from "@/lib/photos";
import { wibDate } from "@/lib/attendance/status";

function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function submitAttendance(formData: FormData): Promise<{ ok: true }> {
  const kind = formData.get("kind");
  if (kind !== "check_in" && kind !== "check_out") throw new Error("Jenis absen tidak valid");

  const selfie = formData.get("selfie");
  if (!(selfie instanceof File) || selfie.size === 0) throw new Error("Foto selfie wajib");
  const validation = validatePhotoFile(selfie);
  if (!validation.ok) throw new Error(validation.error);

  const actor = await getActiveTenantForAttendance();
  const admin = createAdminClient();
  const path = attendancePhotoPath(
    actor.orgId, actor.employeeId, wibDate(new Date()),
    kind === "check_in" ? "in" : "out", validation.extension,
  );

  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, selfie, { contentType: selfie.type, upsert: false });
  if (uploadError) throw new Error(`Gagal mengunggah foto: ${uploadError.message}`);

  const noteValue = formData.get("note");
  const { error } = await actor.supabase.rpc("submit_attendance", {
    p_kind: kind,
    p_selfie_path: path,
    p_lat: numberOrNull(formData.get("lat")),
    p_lng: numberOrNull(formData.get("lng")),
    p_note: typeof noteValue === "string" ? noteValue : null,
  });
  if (error) {
    // Foto sudah terunggah tapi baris absen gagal: jangan tinggalkan sampah.
    if (isSafeObjectPath(path)) await admin.storage.from(PHOTO_BUCKET).remove([path]);
    throw new Error(error.message);
  }

  revalidatePath("/absensi");
  revalidatePath("/app/laporan/absensi");
  return { ok: true };
}
