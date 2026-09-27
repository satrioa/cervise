/**
 * Cek bahwa kredensial Supabase di .env.local memang untuk project yang sama.
 *
 * Nilai yang ada bentuknya berbeda antara key legacy dan key baru:
 *   - legacy  : JWT HS256, payload-nya berisi `ref` (project ref)
 *   - baru    : "sb_secret_..." - string opaque, TIDAK memuat project ref
 *
 * Untuk key baru tidak ada yang bisa dibandingkan, jadi hasilnya null dan
 * pemanggil harus memperlakukannya sebagai "tidak diketahui", bukan "cocok".
 */

export type ProjectRefCheck = {
  urlRef: string | null;
  /** null = tidak bisa dibaca dari key ini (format baru, atau bukan key). */
  keyRef: string | null;
  /** true hanya jika keduanya terbaca DAN sama. */
  matches: boolean;
};

export function checkProjectRef(
  supabaseUrl: string | undefined,
  serviceRoleKey: string | undefined,
): ProjectRefCheck {
  const urlRef = supabaseUrl ? safeHostname(supabaseUrl) : null;

  if (!serviceRoleKey) return { urlRef, keyRef: null, matches: false };

  const segments = serviceRoleKey.trim().split(".");
  // Key baru (sb_secret_...) dan publishable key tidak punya payload JWT.
  if (segments.length !== 3) return { urlRef, keyRef: null, matches: false };

  let keyRef: string | null = null;
  try {
    const payload = JSON.parse(Buffer.from(segments[1], "base64").toString());
    keyRef = typeof payload.ref === "string" ? payload.ref : null;
  } catch {
    // Bentuk JWT tapi payload tidak terbaca - anggap tidak diketahui, jangan
    // dianggap cocok.
    return { urlRef, keyRef: null, matches: false };
  }

  return { urlRef, keyRef, matches: Boolean(urlRef) && urlRef === keyRef };
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.split(".")[0];
  } catch {
    return null;
  }
}
