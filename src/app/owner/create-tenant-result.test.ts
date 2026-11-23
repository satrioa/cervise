import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { friendlyCreateTenantError } from "@/lib/platform/create-tenant-error";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("create tenant error handling", () => {
  it("perror 23505 dipetakan ke pesan yang bisa ditindaklanjuti", () => {
    expect(friendlyCreateTenantError(new Error('duplicate key value violates unique constraint "organizations_slug_key"')))
      .toBe("Nama tenant sudah dipakai. Gunakan nama lain.");
    expect(friendlyCreateTenantError(new Error('duplicate key value violates "users_phone_key"')))
      .toBe("Email atau WhatsApp sudah terdaftar pada akun lain.");
    expect(friendlyCreateTenantError(new Error("koneksi putus"))).toBe("koneksi putus");
  });

  it("action mengembalikan hasil, tidak melempar error mentah", () => {
    const source = read("src/app/owner/actions.ts");
    expect(source).toContain("export type CreateTenantResult");
    expect(source).toContain("return { ok: false, error: friendlyCreateTenantError(error) }");
  });

  it("dialog menampilkan error hasil, bukan error object", () => {
    const source = read("src/components/owner/create-tenant-dialog.tsx");
    expect(source).toContain("if (!result.ok) {");
    expect(source).toContain("toast.error(result.error)");
  });
});
