/**
 * Utilitas foto profil (akun) dan logo tenant.
 *
 * Bucket `cervise-photos` sengaja tidak punya policy storage.objects untuk
 * authenticated/anon, jadi browser tidak bisa menulis ke sana. Semua upload dan
 * remove harus lewat server action yang memakai modul ini untuk validasi dan
 * untuk menyusun path. Modul ini murni: tidak menyentuh database, tidak
 * menyentuh network, sehingga bisa diuji tanpa environment.
 */

export const PHOTO_BUCKET = "cervise-photos";

/** Batas ini juga dikunci di level bucket (file_size_limit), bukan hanya di sini. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type PhotoKind = "avatar" | "tenant-logo";

export type PhotoFileLike = {
  name: string;
  type: string;
  size: number;
};

export type PhotoValidation =
  | { ok: true; extension: string }
  | { ok: false; error: string };

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Menerima tipe MIME yang diklaim browser. Browser biasa hanya mengisi `type`
 * dari ekstensi nama file, jadi ini bukan pemeriksaan konten. Verifikasi
 * sebenarnya tetap relies on bucket: Supabase menolak berkas yang tipe-nya di
 * luar allowed_mime_types.
 */
export function validatePhotoFile(file: PhotoFileLike): PhotoValidation {
  const extension = EXTENSION_BY_MIME[file.type?.trim().toLowerCase() ?? ""];
  if (!extension) {
    return {
      ok: false,
      error: `Format tidak didukung. Gunakan JPG, PNG, atau WEBP (file ini bertipe "${file.type || "tidak dikenal"}").`,
    };
  }
  if (file.size <= 0) {
    return { ok: false, error: "File kosong." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return {
      ok: false,
      error: `Ukuran maksimal ${formatBytes(MAX_PHOTO_BYTES)}. File ini ${formatBytes(file.size)}.`,
    };
  }
  return { ok: true, extension };
}

/**
 * Nama berkas diacak penuh. Kalau nama asli atau id user ikut tersimpan,
 * siapa pun yang punya link lama bisa menebak path foto orang lain dari
 * URL switcher, log, atau screenshot.
 */
function randomSegment(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  }
  // Fallback untuk runtime yang tidak menyediakan crypto.randomUUID.
  const bytes = new Uint8Array(12);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function accountPhotoPath(userId: string, extension: string): string {
  return `avatars/${userId}/${randomSegment()}.${extension}`;
}

export function tenantLogoPath(orgId: string, extension: string): string {
  return `tenant-logos/${orgId}/${randomSegment()}.${extension}`;
}

/**
 * Path yang tersimpan di kolom database kembali ke browser dan dipakai untuk
 * menyusun URL. Kalau nilainya bisa disuntik (mis. "../" atau "http://"),
 * getPublicUrl bisa diarahkan ke host lain. Jadi path dari database wajib
 * lolos cek bentuk dulu.
 */
export function isSafeObjectPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (path.length > 200) return false;
  if (path.includes("..")) return false;
  if (path.startsWith("/") || path.includes("\\")) return false;
  if (!/^(avatars|tenant-logos)\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(path)) return false;
  return true;
}

export function publicPhotoUrl(
  supabaseUrl: string,
  path: string | null | undefined,
): string | null {
  if (!isSafeObjectPath(path)) return null;
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

/**
 * Nilai cadangan kalau belum ada foto. Sengaja dihitung lokal: sebelumnya
 * fallback-nya memanggil api.dicebear.com, yang mengirim nama pengguna ke pihak
 * ketiga setiap kali komponen dirender.
 */
export function initialsOf(name: string | null | undefined): string {
  const cleaned = (name ?? "").trim();
  if (!cleaned) return "?";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}
