import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261025120000_must_change_password.sql",
  ),
  "utf8",
);

const flat = sql.replace(/\s+/g, " ").toLowerCase();

describe("must change password migration", () => {
  it("menambah kolom penanda dengan default aman", () => {
    // Default false: akun yang memang memilih password sendiri (signup) tidak
    // boleh ditandai hanya karena kolomnya ada. Akun buatan admin ditandai
    // eksplisit di jalur pembuatannya.
    expect(flat).toContain(
      "add column if not exists must_change_password boolean not null default false",
    );
  });

  it("menandai semua profil lama, karena deteksi akurat tidak mungkin", () => {
    // Password generated hanya tersimpan sebagai hash, dan auth.users.updated_at
    // ikut bergerak saat login maupun saat admin mengedit email - sudah
    // dibuktikan pada data nyata: akun yang masih memakai password generated
    // justru punya updated_at jauh setelah created_at.
    expect(flat).toContain(
      "update public.profiles set must_change_password = true where must_change_password = false",
    );
    // Tidak boleh kembali memakai timestamp sebagai bukti.
    expect(flat).not.toContain("from auth.users u");
  });

  it("tidak mengganti platform_create_tenant, supaya migrasi tetap DDL sederhana", () => {
    // Penandaan akun BARU dilakukan di server action pembuatnya. Menyalin
    // ulang fungsi database di sini hanya menambah risiko: satu salah tanda
    // tangan atau perubahan versi fungsi membuat seluruh migrasi gagal.
    expect(flat).not.toContain("create or replace function public.platform_create_tenant");
    expect(flat).not.toContain("insert into public.profiles (id, email, full_name, role");
  });
});
