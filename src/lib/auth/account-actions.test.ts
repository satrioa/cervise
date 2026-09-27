import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Penjaga untuk perbaikan yang perilakunya sulit diuji tanpa database.
 *
 * createTenant dan createKaryawan adalah server action yang memanggil
 * supabase.auth.admin, jadi tidak bisa dijalankan di unit test. Yang bisa
 * dijaga di sini adalah cacat spesifiknya: apakah objek createUser menyertakan
 * password, apakah profiles ditulis dengan bentuk huruf kecil, dan apakah
 * rollback benar-benar menghapus profiles. Ketiganya pernah rusak dan tidak
 * terlihat oleh test mana pun.
 */

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

function sliceFunction(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  expect(start, `fungsi ${name} tidak ditemukan`).toBeGreaterThan(-1);
  // Ambil sampai fungsi export berikutnya supaya tidak ikut assertion fungsi lain.
  const rest = source.slice(start + 1);
  const next = rest.search(/\nexport (async )?function /);
  return next === -1 ? source.slice(start) : source.slice(start, start + 1 + next);
}

describe("createTenant", () => {
  const source = readSource("src/app/owner/actions.ts");
  const body = sliceFunction(source, "createTenant");

  it("always passes a password to createUser", () => {
    // Tanpa password, akun owner tidak pernah bisa login: aplikasi ini tidak
    // punya magic link, login murni password.
    const call = body.slice(body.indexOf("auth.admin.createUser"), body.indexOf("auth.admin.createUser") + 400);
    expect(call).toMatch(/password:\s*\w+,/);
    expect(call).not.toMatch(/password:\s*(undefined|null|""|'')\s*,/);
    // Password-nya harus benar-benar dibangkitkan, bukan variabel kosong.
    expect(body).toContain("generateTempPassword()");
  });

  it("keeps email_confirm on, since there is no email verification flow", () => {
    const call = body.slice(body.indexOf("auth.admin.createUser"), body.indexOf("auth.admin.createUser") + 400);
    expect(call).toContain("email_confirm: true");
  });

  it("does not overwrite the password of an account that already exists", () => {
    // Kalau emailnya sudah punya akun, createUser dilewati dan password
    // existing tidak boleh disentuh - diam-diam menimpanya akan mengunci
    // pemilik akun dari akunnya sendiri.
    expect(body).toContain("if (existing)");
    expect(body).not.toMatch(/updateUserById[\s\S]{0,200}password/);
  });

  it("cleans up a newly created auth user when the tenant RPC fails", () => {
    // platform_create_tenant gagal -> tenant tidak ada, tapi akun auth sudah
    // dibuat. Tanpa rollback, ada akun yatim tanpa tenant.
    const rpcIndex = body.indexOf('rpc("platform_create_tenant"');
    expect(rpcIndex).toBeGreaterThan(-1);
    const after = body.slice(rpcIndex);
    expect(after).toContain("deleteUser(ownerId)");
  });

  it("returns the temporary password to the caller so it can be shown once", () => {
    expect(body).toContain("tempPassword: tempPassword ?? undefined");
  });
});

describe("createKaryawan", () => {
  const source = readSource("src/app/app/karyawan/actions.ts");
  const body = sliceFunction(source, "createKaryawan");

  it("writes profiles.role through the lowercase mapping, never the raw target role", () => {
    // profiles CHECK constraint hanya menerima huruf kecil. Menulis
    // targetRole (huruf besar) membuat insert ditolak total.
    const profileBlock = body.slice(body.indexOf("const profilePatch"), body.indexOf("from(\"employees\")"));
    expect(profileBlock).toContain("role: profileRole");
    expect(profileBlock).not.toContain("role: targetRole");
    expect(body).toContain("EMPLOYEE_TO_PROFILE_ROLE[targetRole]");
  });

  it("gates on the same rule as the employees_insert policy", () => {
    expect(body).toContain("canManageEmployees(role)");
  });

  it("deletes the profiles row during rollback, not just the auth user", () => {
    // Rollback yang hanya menghapus user auth meninggalkan baris profiles
    // yatim, sehingga email itu terlihat "sudah dipakai" padahal tidak ada
    // akun yang bisa login.
    const employeeInsert = body.indexOf('from("employees")');
    expect(employeeInsert).toBeGreaterThan(-1);
    const rollback = body.slice(employeeInsert);
    const profilesDelete = rollback.indexOf('from("profiles").delete()');
    const authDelete = rollback.indexOf("deleteUser(uid)");
    expect(profilesDelete).toBeGreaterThan(-1);
    expect(authDelete).toBeGreaterThan(-1);
    // profiles harus dihapus lebih dulu, dan keduanya ada di blok yang sama.
    expect(profilesDelete).toBeLessThan(authDelete);
  });

  it("translates an RLS rejection into a message the user can act on", () => {
    expect(body).toMatch(/row-level security|permission denied/);
  });
});

describe("updateKaryawan", () => {
  const source = readSource("src/app/app/karyawan/actions.ts");
  const body = sliceFunction(source, "updateKaryawan");

  it("keeps profiles.role in sync with the new employees.role", () => {
    // Dulu role tidak pernah ditulis ke profiles, jadi mengubah peran lewat UI
    // membuat dua tabel berbeda pendapat.
    expect(body).toContain("profilePatch.role = profileRole");
  });

  // Tiga tulisan berurutan: employees -> profiles -> auth. Kalau salah satu
  // gagal, dua yang sebelumnya sudah tertulis harus dikembalikan, kalau tidak
  // ada karyawan dengan role berbeda di employees dan profiles.
  it("captures the previous values before writing", () => {
    expect(body).toContain('const previousRole = String(employee.role)');
    expect(body).toContain("previousProfile");
    expect(body).toContain('const profileId = employee.profile_id');
  });

  it("restores employees when the profiles update fails", () => {
    // Dicek di dalam blok gagalnya, bukan "di mana saja setelahnya" - kalau
    // hanya dicek keberadaan string, menghapus restoreEmployee() dari blok itu
    // tidak akan terdeteksi karena pemanggilan lain masih ada.
    const blockStart = body.indexOf("if (profileError || !updatedProfile) {");
    expect(blockStart).toBeGreaterThan(-1);
    const block = body.slice(blockStart, body.indexOf("}", body.indexOf("throw", blockStart)));
    expect(block).toContain("restoreEmployee()");
  });

  it("restores both tables when the auth email update fails", () => {
    const authUpdate = body.indexOf("updateUserById");
    expect(authUpdate).toBeGreaterThan(-1);
    const after = body.slice(authUpdate);
    // Urutan pembatalan harus terbalik: profiles dulu, baru employees.
    expect(after).toContain("restoreProfile()");
    expect(after).toContain("restoreEmployee()");
    expect(after.indexOf("restoreProfile()")).toBeLessThan(after.indexOf("restoreEmployee()"));
  });
});

describe("requireMasterAdmin", () => {
  const source = readSource("src/lib/supabase/actor.ts");

  it("no longer admits ADMIN inline", () => {
    const body = sliceFunction(source, "requireMasterAdmin");
    // allowlist ["MASTER_ADMIN", "ADMIN"] dulu membuat ADMIN lolos gate lalu
    // ditolak RLS. Sekarang gate-nya dipusatkan ke canManageEmployees.
    expect(body).not.toContain('["MASTER_ADMIN", "ADMIN"]');
    expect(body).toContain("canManageEmployees(actor.role)");
  });
});
