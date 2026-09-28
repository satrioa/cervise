import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tombol "Buat Tenant Baru" di tenant switcher dulu selalu dirender, untuk
 * semua user tenant. MASTER_ADMIN yang kebetulan pemilik tenant pun -
 * bukan staff Cervise - mengkliknya, lalu requirePlatformAdmin menghantarkan
 * dia ke layar login, padahal session-nya masih hidup. Pengalaman itu dilaporkan
 * sebagai "kenapa perlu login", padahal masalahnya otorisasi.
 *
 * onManage MultipleAccounts bersifat opsional, jadi cara membetulkannya adalah
 * tidak meneruskannya. Test ini menjaga syarat itu tidak kembali longgar.
 */

function readCode(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !(/(?<!:)\/\//.test(line) || line.trimStart().startsWith("//")))
    .join("\n");
}

const appShell = readCode("src/components/layout/app-shell.tsx");
const tenantContext = readCode("src/lib/tenant-context.tsx");

describe("tombol manage tenant hanya untuk staff platform", () => {
  it("TenantSwitcher membaca isPlatformAdmin dari context", () => {
    expect(appShell).toMatch(/useTenant\(\)/);
    expect(appShell).toMatch(/const \{[^}]*isPlatformAdmin[^}]*\} = useTenant\(\)/);
  });

  it("onManage hanya diteruskan ketika isPlatformAdmin", () => {
    // Pola saklanya harus tetap terkondisi; onManage yang polos akan
    // mengembalikan bug ini tanpa perlu mengubah baris lain.
    expect(appShell).toMatch(/isPlatformAdmin\s*\?\s*\{\s*onManage:/);
    expect(appShell).not.toMatch(/^\s*onManage=\{\(\) => router\.push/m);
  });

  it("tidak ada onManage yang selalu diteruskan ke MultipleAccounts", () => {
    const multipleAccountsBlock = appShell.slice(appShell.indexOf("<MultipleAccounts"));
    expect(multipleAccountsBlock.slice(0, 600)).not.toMatch(/\n\s*onManage=\{/);
  });

  it("petunjuk 'Buat tenant di /owner' juga ikut disembunyikan", () => {
    // Jalur kedua ke /owner yang tidak lewat MultipleAccounts.
    const hintIndex = appShell.indexOf("Buat tenant di /owner");
    expect(hintIndex).toBeGreaterThan(-1);
    const before = appShell.slice(Math.max(0, hintIndex - 400), hintIndex);
    expect(before).toMatch(/isPlatformAdmin\s*\?\s*\(/);
  });
});

describe("isPlatformAdmin berasal dari platform_admins, bukan dari role tenant", () => {
  it("tenant-context menanyakan tabel platform_admins", () => {
    expect(tenantContext).toContain("from(\"platform_admins\")");
  });

  it("hanya membaca baris milik user sendiri dan yang aktif", () => {
    // Policy platform_admins_select hanya mengizinkan baris sendiri; tanpa
    // filter profile_id, RLS akan menolak query-nya dan semua user tenant
    // dianggap bukan platform admin karena error, bukan karena memang tidak punya.
    // Filter is_active mencegah akun yang dinonaktifkan tetap bisa membuat tenant.
    const block = tenantContext.slice(tenantContext.indexOf("platform_admins"));
    expect(block).toMatch(/eq\("profile_id",\s*auth\.user\.id\)/);
    expect(block.slice(0, 300)).toMatch(/eq\("is_active",\s*true\)/);
  });

  it("default-nya false supaya tombol tidak berkedip sebelum query selesai", () => {
    expect(tenantContext).toMatch(/useState\(false\)/);
  });

  it("bukan employees.role yang dipakai untuk menentukan akses /owner", () => {
    // Role tenant tidak boleh jadi penentu: MASTER_ADMIN adalah peran
    // operasional, bukan staff platform.
    expect(tenantContext).not.toMatch(/isPlatformAdmin[^=]*=.*role/);
  });
});
