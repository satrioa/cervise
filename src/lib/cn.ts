import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Dua nama ini ikut diekspor supaya file yang tadinya mengimpor dari paket
 * `cn` tidak harus diubah isinya: `dropdown.tsx` memakai `twJoin`, dan
 * `primitive.ts` memakai tipe `ClassNameValue`. Keduanya milik tailwind-merge,
 * bukan fungsi terpisah yang perlu ditulis ulang.
 */
export { twJoin, type ClassNameValue } from "tailwind-merge";
