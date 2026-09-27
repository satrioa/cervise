"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjectRef } from "@/lib/supabase/env-check";

export async function signupAction(input: { name: string; email: string; password: string }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!name) throw new Error("Nama wajib");
  if (!email || !email.includes("@")) throw new Error("Email tidak valid");
  if (!password || password.length < 8) throw new Error("Password minimal 8 karakter");

  // Validasi kecocokan project hanya bisa dilakukan untuk key JWT legacy.
  // Key baru (sb_secret_...) tidak memuat project ref, jadi results.matches
  // bernilai false dan pemeriksaan ini dilewati - bukan berarti cocok.
  const check = checkProjectRef(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  if (check.keyRef && check.urlRef && !check.matches) {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY tidak cocok dengan URL (${check.keyRef} ≠ ${check.urlRef}). Periksa .env.local`,
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) {
    const raw = String(error.message ?? "");
    const msg = raw.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already exists")) {
      throw new Error("Email sudah terdaftar — silakan Masuk.");
    }
    if (msg.includes("invalid api key")) {
      // fallback to anon signUp so user is not blocked by env mismatch
      const supabase = await createClient();
      const { error: anonErr } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (anonErr) {
        throw new Error(
          `Invalid API key (service_role mismatch) dan anon juga gagal: ${anonErr.message}. ` +
            `Cek .env.local URL vs key ref (${check.urlRef} vs ${check.keyRef ?? "tidak terbaca - key format baru"})`,
        );
      }
      return { ok: true as const };
    }
    throw new Error(error.message);
  }
  const uid = data.user?.id;
  if (uid) {
    // ensure profiles row has full_name & email (trigger handle_new_user may already did)
    await admin.from("profiles").upsert({ id: uid, full_name: name, email } as never, { onConflict: "id" } as never);
  }
  return { ok: true as const };
}
