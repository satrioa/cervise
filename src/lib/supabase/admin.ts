import { createClient } from "@supabase/supabase-js";

/**
 * Service role untuk operasi yang tidak boleh melewati RLS: membuat akun,
 * menulis kolom yang sengaja dikunci,/storage.
 *
 * Modul ini HANYA boleh diimpor dari server. Kalau ikut terbawa ke bundle
 * browser, seluruh RLS project jadi tidak berarti.
 */

/**
 * Key service role punya dua format:
 *   - legacy  : JWT HS256, 3 segment dipisah titik
 *   - baru    : "sb_secret_..." (Supabase API Keys baru)
 *
 * Pemeriksaan ini menangkap placeholder yang lolos ke .env.local - dulu
 * SUPABASE_SERVICE_ROLE_KEY berisi "dummy", dan setiap pemanggilan gagal dengan
 * `Invalid Compact JWS` yang tidak mengarah ke penyebab sebenarnya.
 */
export function assertUsableServiceRoleKey(key: string | undefined): string {
  if (!key || key.trim() === "") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum diset di .env.local. Ambil dari Supabase Dashboard > Project Settings > API Keys.",
    );
  }

  const value = key.trim();
  const isLegacyJwt = value.split(".").length === 3;
  const isNewFormat = value.startsWith("sb_secret_");

  if (!isLegacyJwt && !isNewFormat) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY tidak valid. Nilai yang ada bukan JWT tiga segment maupun key sb_secret_. " +
        "Kemungkinan masih placeholder - ganti dengan key asli dari Supabase Dashboard > Project Settings > API Keys.",
    );
  }

  return value;
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL belum diset di .env.local");
  }
  const serviceRoleKey = assertUsableServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
