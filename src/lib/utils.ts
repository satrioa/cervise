import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * `@/lib/utils` adalah satu-satunya jalur import `cn` di repo ini. Dulu ada
 * `@/lib/cn` (isi asli) dan `@/lib/utils` (shim yang meneruskan ke situ);
 * shimnya dihapus supaya tidak ada dua nama untuk satu fungsi. Lihat
 * `src/components/ui/laptop-mockup.test.ts` yang mengunci arah ini.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}