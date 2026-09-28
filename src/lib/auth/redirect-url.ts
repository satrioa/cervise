import { headers } from "next/headers";

/**
 * Origin aplikasi untuk link auth (reset password, dll).
 *
 * Why headers and not a hardcoded domain: the app belum punya env origin
 * sendiri, dan menambahkannya berarti satu langkah konfigurasi lagi di tiap
 * environment (Vercel, lokal, nanti host lain). Header `host` selalu tersedia
 * pada request yang masuk, jadi ini langsung benar di mana pun aplikasi
 * dijalankan tanpa konfigurasi.
 *
 * Kenapa ini tidak menjadi open redirect: Supabase tidak akan mengirim user ke
 * redirectTo yang tidak ada di allowlist-nya. Kalau ada yang memalsukan header
 * Host, link-nya ditolak oleh Supabase, bukan oleh kita. Allowlist Supabase
 * adalah gerbang sesungguhnya di sini.
 *
 * Kalau suatu saat app punya env origin (mis. saat pindah ke domain sendiri),
 * `NEXT_PUBLIC_SITE_URL` otomatis diprioritaskan tanpa mengubah call site.
 */

export type HeaderReader = (name: string) => string | null;

function firstNonEmpty(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/** Header yang dipakai reverse proxy (Vercel, Nginx, Cloudflare) didahulukan. */
export function resolveAppOrigin(headers: HeaderReader, envSiteUrl?: string | null): string | null {
  const fromEnv = firstNonEmpty(envSiteUrl);
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  const host = firstNonEmpty(headers("x-forwarded-host"), headers("host"));
  if (!host) return null;

  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
  const protocol = firstNonEmpty(headers("x-forwarded-proto")) ?? (isLocal ? "http" : "https");

  return `${protocol}://${host}`;
}

export const PASSWORD_RESET_PATH = "/update-password";

/**
 * URL absolut untuk link reset password.
 *
 * Melempar error kalau host tidak bisa ditentukan.Versi sebelumnya memakai
 * `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/login`, jadi ketika env itu tidak
 * ada, Supabase menerima "/login" - target relatif yang ditolak Supabase, dan
 * user tidak pernah sampai ke form ganti password.
 */
export async function getAppOrigin(): Promise<string> {
  const headerList = await headers();
  const origin = resolveAppOrigin((name) => headerList.get(name), process.env.NEXT_PUBLIC_SITE_URL);

  if (!origin) {
    throw new Error(
      "Tidak bisa menentukan origin aplikasi dari header request. Pastikan request memiliki header Host.",
    );
  }
  return origin;
}

export async function passwordResetRedirectUrl(path: string = PASSWORD_RESET_PATH): Promise<string> {
  if (!path.startsWith("/")) {
    throw new Error(`Path redirect harus diawali "/": ${path}`);
  }
  return `${await getAppOrigin()}${path}`;
}
