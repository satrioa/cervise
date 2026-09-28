import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PHONE_INPUT_PATTERN, PHONE_MAX_LENGTH } from "@/lib/phone";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260925210000_profile_phone_validation.sql",
);

// Tanpa guard ini, file migration yang hilang membuat seluruh file test gagal
// waktu dikumpulkan, dan assertion di bawah tidak pernah sempat melaporkan
// apa pun. Pola yang sama dipakai dua test migrasi lain di direktori ini:
// src/lib/auth/photo-migration.test.ts dan
// src/lib/auth/service-spareparts-migration.test.ts.
const sql = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n")
  : "";

// Migration dibaca menjadi dua bentuk. `flat` masih menyimpan comment, dipakai
// untuk memeriksa comment-nya jujur. `ddl` membuang baris comment, dipakai
// untuk memeriksa DDL-nya benar.
//
// Guard WAJIB menguji `ddl`. Kalau menguji `flat`, comment yang benar saja
// bisa membuat assertion gagal (comment sah yang menyebut "grant update" demi
// menjelaskan kenapa grant itu TIDAK disentuh), dan sebaliknya DDL yang sudah
// dihapus tetap akan lolos selama comment-nya masih mengutip DDL itu.
const ddl = sql
  .replace(/--.*$/gm, "")
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("profile phone validation migration", () => {
  it("migration-nya ada", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("menegakkan format nomor di database", () => {
    expect(ddl).toContain("add constraint profiles_phone_charset");
    expect(ddl).toContain("phone is null or");
  });

  it("memakai kelas karakter dan batas panjang yang sama dengan aplikasi", () => {
    // Expectation dibangun dari konstanta aplikasi, bukan dari salinan literal.
    // Kalau salah ketik di salah satu sisi, test ini gagal — itulah satu-satunya
    // yang menjaga constraint dan validatePhone tetap sama.
    expect(ddl).toContain(`phone ~ '${PHONE_INPUT_PATTERN}'`);
    expect(ddl).toContain(`length(phone) <= ${PHONE_MAX_LENGTH} and`);
  });

  it("tidak ikut menegakkan bentuk kanonik", () => {
    // account-input.ts:108 menyimpan input mentah, jadi constraint yang menuntut
    // `^62[0-9]+$` akan menggagalkan penulisan nomor dari form karyawan.
    expect(ddl).not.toContain("^62");
  });

  it("tidak menambah kolom nomor ke employees", () => {
    expect(ddl).not.toContain("alter table public.employees");
  });

  it("tidak mengubah hak akses", () => {
    expect(ddl).not.toContain("grant");
    expect(ddl).not.toContain("revoke");
  });

  it("tidak menyentuh tabel atau policy lain", () => {
    expect(ddl).not.toContain("create policy");
    expect(ddl).not.toContain("drop policy");
    expect(ddl).not.toContain("create table");
  });

  it("tidak menghapus data untuk lolos dari constraint", () => {
    expect(ddl).not.toContain("delete");
    expect(ddl).not.toContain("update ");
    expect(ddl).not.toContain("not valid");
  });
});
