import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Dua bug reset password yang keduanya menyia-nyiakan email yang terkirim:
 *
 * 1. karyawan/actions.ts mengirim redirectTo ke `${SUPABASE_URL}/auth/callback`
 *    - domain Supabase, bukan aplikasi. User klik link-nya dan mendarat di
 *    Supabase, tidak pernah sampai ke Cervise.
 * 2. pengaturan/profil/actions.ts memakai `${NEXT_PUBLIC_SITE_URL ?? ""}/login`
 *    - env itu tidak pernah didefinisikan, jadi targetnya URL relatif
 *    "/login" yang ditolak Supabase.
 *
 * Keduanya gagal diam-diam dari sisi user: admin menekan "kirim", tidak ada
 * error, tapi tidak ada juga email yang sampai. Test ini menjaga redirectTo
 * tetap absolut dan tetap milik app.
 */

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

/**
 * Komentar ikut dibuang sebelum diperiksa. Kedua file ini menjelaskan bug lama
 * secara eksplisit di dalam komentar, jadi tanpa filter ini test akan gagal
 * karena dokumentasinya, bukan karena kodenya.
 */
function readCode(relativePath: string): string {
  return read(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => {
      // Jangan sampai "//" di dalam "https://" ikut terpotong.
      const trimmed = line.trimStart();
      if (trimmed.startsWith("//")) return false;
      return !/(?<!:)\/\//.test(line);
    })
    .join("\n");
}

const karyawanActions = readCode("src/app/app/karyawan/actions.ts");
const profilActions = readCode("src/app/app/pengaturan/profil/actions.ts");

describe("password reset redirect targets", () => {
  it("karyawan reset redirects into the app, not to the Supabase domain", () => {
    expect(karyawanActions).toContain("passwordResetRedirectUrl()");
    expect(karyawanActions).not.toMatch(/redirectTo:[^}]*NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("profil reset redirects into the app instead of an undefined env origin", () => {
    expect(profilActions).toContain("passwordResetRedirectUrl()");
    expect(profilActions).not.toContain("NEXT_PUBLIC_SITE_URL");
  });

  it("never passes a relative redirectTo to resetPasswordForEmail", () => {
    for (const source of [karyawanActions, profilActions]) {
      const calls = source.match(/resetPasswordForEmail\([\s\S]*?\}\);/g) ?? [];
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call).toContain("passwordResetRedirectUrl(");
      }
    }
  });

  it("points at a route that actually exists in the app", () => {
    // The landing route must be a real page, otherwise the fix just moves the
    // 404 from Supabase's domain to ours.
    expect(() => read("src/app/update-password/page.tsx")).not.toThrow();
  });
});

describe("karyawan reset failure handling", () => {
  it("surfaces a send failure instead of reporting a success nobody received", () => {
    const body = karyawanActions.slice(karyawanActions.indexOf("export async function resetKaryawanPassword"));
    expect(body).toMatch(/if \(error\) \{[\s\S]*throw new Error/);
    // generateLink() only mints a link server-side; it never sends mail, so it
    // must not be used as a silent fallback.
    expect(body).not.toContain("generateLink");
  });
});
