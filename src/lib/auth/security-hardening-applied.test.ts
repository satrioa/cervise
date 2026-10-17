import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Penjaga untuk migration yang sudah TER-APPLY ke database produksi.
 *
 * Yang membedakan test ini dari test penjaga lain di repo: dia membaca
 * SELURUH isi folder migration, bukan satu nama file. Sepuluh test lain
 * meng-hardcode satu nama file, jadi migration baru yang membatalkan invarian
 * akan lolos tanpa membuat test merah. Di sini migration berikutnya ikut
 * terbaca, dan test gagal saat invariantnya dirusak dari arah mana pun.
 *
 * Yang dibaca tetap file SQL di repo. Itu bukan bukti keadaan database sungguhan
 * - nomor versi ter-apply tidak selalu sama dengan nama file, dan dashboard
 * bisa diedit manual. Test ini menjaga repository; verifikasi nyata dilakukan
 * dengan query pg_policies / pg_proc.
 */
const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/**
 * SQL dari satu migration dan semua yang lebih baru. Ini yang dipakai untuk
 * memeriksa keadaan AKHIR: migration lama boleh menyebut sesuatu yang
 * migration berikutnya hapus.
 */
function sqlFrom(fileName: string): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  return files
    .slice(files.indexOf(fileName))
    .map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
    .join("\n");
}

function normalize(sql: string) {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

describe("invarian yang sudah diterapkan ke produksi", () => {
  it("adjust_product_stock tidak pernah lagi dibuat dengan 3 parameter", () => {
    // Bug yang diuji: 20260925220000 membuat ulang arity 3 yang menulis
    // stock_qty inline tanpa apply_stock_delta, lalu ME-GRANT-nya ke
    // authenticated. 20261017155754 menghapusnya.
    //
    // Yang diperiksa hanya migration SETELAH penghapusan. 20260925140000 dan
    // 20260925220000 boleh dan memang pernah membuat arity 3 - itu catatan
    // sejarah. Yang tidak boleh ada adalah pembuatan ulang sesudahnya.
    const after = sqlFrom("20261017155754_drop_adjust_product_stock_3arg.sql");
    const createCalls = [
      ...after.matchAll(
        /create\s+(?:or\s+replace\s+)?function\s+public\.adjust_product_stock\s*\(([^)]*)\)/g,
      ),
    ];
    for (const match of createCalls) {
      const params = match[1].split(",").filter((part) => part.trim().length > 0);
      expect(params.length).not.toBe(3);
    }
    expect(after).toContain(
      "drop function if exists public.adjust_product_stock(uuid, integer, integer)",
    );
  });

  it("tidak ada grant execute untuk adjust_product_stock 3-arg setelah dihapus", () => {
    const after = normalize(sqlFrom("20261017155754_drop_adjust_product_stock_3arg.sql"));
    expect(after).not.toMatch(
      /grant execute on function public\.adjust_product_stock\(uuid, integer, integer\)/,
    );
  });

  it("peran anon tidak memegang hak tulis di tabel mana pun", () => {
    // Bug yang diuji: 20260925090000 memberi grant-all, termasuk ke anon, ke
    // tabel seperti platform_admins dan organizations. Tidak berbahaya selama
    // tidak ada policy anon - tapi itu ketergantungan, bukan jaminan.
    const revoke = sqlFrom("20261017155421_revoke_anon_write_grants.sql").toLowerCase();
    for (const table of [
      "public.platform_admins",
      "public.organizations",
      "public.employees",
      "public.profiles",
    ]) {
      expect(revoke).toContain(table);
    }
    expect(revoke).toMatch(/revoke insert, update, delete on table[\s\S]*from anon;/);
    expect(revoke).toMatch(/revoke all on table[\s\S]*from public;/);
  });

  it("perubahan role karyawan dijaga trigger", () => {
    // Bug yang diuji: policy employees_update mengizinkan ADMIN menulis baris
    // di cabangnya sendiri, dan grant kolomnya memuat `role`. Satu PATCH
    // /rest/v1/employees sudah cukup untuk jadi MASTER_ADMIN seluruh tenant.
    const sql = normalize(sqlFrom("20261017155450_guard_employee_role_change.sql"));
    expect(sql).toContain("create or replace function public.guard_employee_role_change()");
    expect(sql).toContain("before insert or update on public.employees");
    expect(sql).toContain("is_platform_admin()");
    expect(sql).toContain("has_tenant_role");
    expect(sql).toContain("42501");
  });

  it("caller_branch_role memeriksa profil, cabang, organisasi, dan langganan", () => {
    // caller_branch_role adalah satu-satunya penjaga empat RPC sparepart/status,
    // semuanya di-grant ke authenticated dan bisa dipanggil lewat REST.
    const sql = normalize(sqlFrom("20261017155820_harden_caller_branch_role.sql"));
    expect(sql).toContain("profile.is_active = true");
    expect(sql).toContain("branch.is_active = true");
    expect(sql).toContain("organization.status not in ('blocked', 'suspended', 'cancelled')");
    expect(sql).toContain("subscription.status");
  });

  it("caller_branch_role tidak pernah mengembalikan NULL", () => {
    // Bug yang diuji: guard keempat RPC berbunyi
    //   if not (is_platform_admin() or v_role in (...)) then
    // NULL in (...) adalah NULL, bukan false, jadi not (false or NULL) = NULL,
    // dan "IF NULL THEN" di PL/pgSQL dianggap false. Guard dilewati, exception
    // tidak pernah dibuang. ADMIN/FRONTLINER/TECHNICIAN yang tidak lagi punya
    // akses tetap bisa mengubah status servis dan movements stok.
    const sql = normalize(sqlFrom("20261017155945_fix_rpc_null_role_fail_open.sql"));
    expect(sql).toContain("caller_branch_role");
    expect(sql).toMatch(/select coalesce\(/);
    // Penutupnya harus string kosong, bukan null.
    expect(sql).toMatch(/\), ''\);/);
  });

  it("is_platform_admin dikunci ke auth.uid()", () => {
    // Bug yang diuji: parameter berasal dari pemanggil, jadi siapa pun bisa
    // menebak UUID mana yang platform admin lewat satu panggilan REST.
    const sql = normalize(sqlFrom("20261017160024_pin_is_platform_admin_to_caller.sql"));
    const body = sql.slice(sql.indexOf("as $function$"));
    expect(body).toContain("profile_id = auth.uid()");
    expect(body).not.toContain("profile_id = check_user_id");
  });
});