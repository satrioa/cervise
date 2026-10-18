import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync("src/app/signup/actions.ts", "utf8");

describe("signupAction menulis profil", () => {
  /**
   * `profiles.role` adalah NOT NULL tanpa default, jadi `upsert` tanpa `role`
   * selalu ditolak database.uperror itu tidak diperiksa, jadi user melihat
   * "Akun dibuat" padahal baris profil tidak pernah ada.
   *
   * Alur signup sendiri tetap berfungsi karena `complete_tenant_onboarding`
   * membuat profil dengan role dari `auth.users.raw_user_meta_data`. Yang
   * rusak adalah kepSilent: kalau onboarding nanti gagal atau berubah, tidak
   * ada yang tahu signup sudah setengah jadi.
   */
  it("menulis role saat upsert profil, bukan hanya id dan nama", () => {
    expect(SOURCE).toMatch(
      /\.from\("profiles"\)[\s\S]{0,200}?role:\s*PROFILE_ROLE\.MASTER_ADMIN/,
    );
  });

  it("memeriksa error upsert, tidak membuang hasil await", () => {
    // Hasil `upsert` harus diambil lalu diperiksa. Pola repo ini:
    // `const { error } = await ...; if (error) throw ...`.
    expect(SOURCE).toMatch(
      /const\s*\{\s*error:\s*profileError\s*\}\s*=\s*await\s+admin/,
    );
    expect(SOURCE).toMatch(/if\s*\(profileError\)\s*throw\s+new\s+Error\(profileError\.message\)/);
  });

  it("membaca role dari satu konstanta yang sama dengan migrasi onboarding", () => {
    // `PROFILE_ROLE.MASTER_ADMIN` dan literal 'master_admin' adalah string yang
    // sama; test ini mengunci bahwa konstanta itu yang dipakai, supaya perubahan
    // di satu sisi tidak diam-diam berbeda dengan migrasi.
    expect(SOURCE).toContain('from "@/lib/auth/account-input"');
  });
});