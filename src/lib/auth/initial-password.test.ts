import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Checkout Windows memakai CRLF; pencocokan teks sumber jangan bergantung itu.
const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8").replace(/\r\n/g, "\n");

const action = read("src/app/app/actions/initial-password.ts");
const dialog = read("src/components/initial-password-dialog.tsx");
const layout = read("src/app/app/layout.tsx");
const actor = read("src/lib/supabase/actor.ts");

/**
 * Akun yang dibuat admin memakai password generated. Sampai user menggantinya,
 * dashboard menampilkan dialog yang hanya meminta password baru + konfirmasi.
 * Password generated yang baru saja dipakai login tidak boleh diminta lagi.
 */
describe("dialog ganti password pertama", () => {
  it("hanya meminta password baru dan konfirmasi", () => {
    expect(dialog).toContain('id="initial-new-password"');
    expect(dialog).toContain('id="initial-confirm-password"');
    // Tidak ada field password lama / generated.
    expect(dialog).not.toContain('id="current-password"');
    expect(dialog).not.toContain('autoComplete="current-password"');
    expect(dialog).toContain("password !== confirm");
  });

  it("tidak bisa ditutup sebelum password diganti", () => {
    // Escape, klik backdrop, dan tombol X semuanya harus tidak menutup dialog.
    expect(dialog).toContain("showCloseButton={false}");
    expect(dialog).toContain("disablePointerDismissal");
    expect(dialog).toContain("onOpenChange={() => {}}");
    expect(dialog).toContain("<Dialog\n      open");
  });

  it("setelah berhasil logout dan login ulang dengan password baru", () => {
    expect(dialog).toContain("supabase.auth.signOut()");
    expect(dialog).toContain('router.replace("/login?password=updated")');
  });

  it("dirender di layout /app, bukan hanya di satu halaman", () => {
    // Kalau dialog hanya ada di dashboard, user bisa membuka route /app lain
    // untuk melewatinya.
    expect(layout).toContain(
      "<InitialPasswordDialog mustChange={Boolean(actor.mustChangePassword)} />",
    );
  });
});

describe("server action ganti password pertama", () => {
  it("hanya menerima password baru, bukan userId dari klien", () => {
    expect(action).toMatch(/export async function changeInitialPassword\(\s*newPassword: string,?\s*\)/);
    // Target selalu dari sesi.
    expect(action).toContain("updateUserById(auth.user.id");
    expect(action).not.toMatch(/input\.userId|targetUserId/);
  });

  it("menolak akun yang password-nya sudah pernah diganti", () => {
    // Tanpa guard ini, action menjadi jalan pintas ganti password tanpa tahu
    // password lama untuk akun normal.
    expect(action).toContain('select("must_change_password")');
    expect(action).toContain("if (!profile?.must_change_password)");
    expect(action).toContain("sudah pernah diganti");
  });

  it("menulis password lewat service role lalu membersihkan penanda", () => {
    expect(action).toContain("createAdminClient()");
    expect(action).toContain("admin.auth.admin.updateUserById");
    expect(action).toContain(".update({ must_change_password: false })");
  });

  it("memakai aturan panjang password yang sama dengan signup", () => {
    expect(action).toContain("meetsPasswordLength(newPassword)");
    expect(dialog).toContain("meetsPasswordLength(password)");
  });
});

describe("penanda must_change_password", () => {
  it("dibaca bersama profil yang sudah diambil actor", () => {
    // Satu select, bukan query tambahan di setiap request.
    expect(actor).toContain("must_change_password");
    expect(actor).toContain("mustChangePassword: Boolean(profile.must_change_password)");
  });

  it("ditulis oleh setiap jalur pembuatan akun admin", () => {
    expect(read("src/app/app/karyawan/actions.ts")).toContain("must_change_password: true");
    expect(read("src/app/app/pengaturan/master-admin-actions.ts")).toContain(
      "must_change_password: true",
    );

    // Owner tenant: ditandai setelah RPC berhasil, dan HANYA kalau akun auth-nya
    // baru dibuat (tempPassword terisi). Akun existing yang dipakai ulang tidak
    // boleh dipaksa mengganti password yang sudah dia punya.
    const owner = read("src/app/owner/actions.ts");
    expect(owner).toMatch(
      /if \(tempPassword\) \{[\s\S]{0,400}must_change_password: true/,
    );
  });

  it("signup tidak ikut ditandai karena user memilih password sendiri", () => {
    expect(read("src/app/signup/actions.ts")).not.toContain("must_change_password");
  });
});
