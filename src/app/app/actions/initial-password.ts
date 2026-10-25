"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MIN_PASSWORD_LENGTH, meetsPasswordLength } from "@/lib/auth/password-policy";

export type ChangeInitialPasswordResult = { ok: true } | { ok: false; error: string };

/**
 * Ganti password untuk akun yang masih memakai password generated.
 *
 * Hanya boleh dipakai selama `profiles.must_change_password` masih `true`.
 * Tanpa penjagaan itu, action ini menjadi jalan pintas "ganti password tanpa
 * tahu password lama" untuk akun normal - jalur biasa tetap lewat link reset
 * di halaman Profil.
 *
 * Password lama sengaja TIDAK diminta: user baru saja login dengan password
 * generated itu, dan mengulanginya di sini hanya menambah friksi.
 */
export async function changeInitialPassword(
  newPassword: string,
): Promise<ChangeInitialPasswordResult> {
  if (!meetsPasswordLength(newPassword)) {
    return { ok: false, error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.` };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { ok: false, error: "Sesi login tidak valid. Silakan masuk lagi." };
  }

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!profile?.must_change_password) {
    return { ok: false, error: "Password akun ini sudah pernah diganti." };
  }

  // Password ditulis lewat service role supaya penanda bisa dibersihkan pada
  // alur yang sama. `updateUserById` tidak butuh password lama - identitas
  // pemanggil sudah dipastikan dari sesi di atas, dan targetnya selalu
  // `auth.user.id`, tidak pernah dari input klien.
  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(auth.user.id, {
    password: newPassword,
  });
  if (updateError) return { ok: false, error: updateError.message };

  const { error: clearError } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", auth.user.id);
  if (clearError) {
    // Password sudah berganti tetapi penanda gagal dibersihkan. User boleh
    // mencoba lagi; action ini masih menerima karena penanda masih `true`.
    return { ok: false, error: clearError.message };
  }

  return { ok: true };
}
