import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SQL = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261107120000_cash_sessions_per_branch.sql"),
  "utf8",
).replace(/\s+/g, " ");

/**
 * Sesi kas dulu milik karyawan. Kalau frontliner libur, tidak ada yang bisa
 * membuka laci. Migration ini memindahkan kepemilikan sesi ke cabang.
 */
describe("sesi kas per cabang", () => {
  it("mengganti index unik dari employee_id ke branch_id", () => {
    expect(SQL).toContain("drop index if exists public.cervise_cash_sessions_open_unique");
    expect(SQL).toContain(
      "create unique index if not exists cervise_cash_sessions_open_unique on public.cervise_cash_sessions(branch_id) where closed_at is null",
    );
  });

  it("menutup sesi ganda sebelum index baru dibuat", () => {
    // Index per karyawan bisa menyisakan dua sesi terbuka di satu cabang.
    expect(SQL).toContain("partition by branch_id");
    expect(SQL).toContain("jsonb_build_object");
    expect(SQL.indexOf("partition by branch_id")).toBeLessThan(
      SQL.indexOf("create unique index"),
    );
  });

  it("select dan update dibuka untuk semua role kas di cabang", () => {
    for (const action of ["select", "update"] as const) {
      const anchor = `create policy cervise_cash_sessions_${action} on public.cervise_cash_sessions`;
      const start = SQL.indexOf(anchor);
      expect(start, `policy ${action} harus ada`).toBeGreaterThanOrEqual(0);
      const body = SQL.slice(start, SQL.indexOf(";", start));
      expect(body.replace(/\s+/g, "")).toContain(
        "array['MASTER_ADMIN','ADMIN','FRONTLINER']::text[]",
      );
      expect(body.indexOf("public.is_platform_admin()")).toBeLessThan(
        body.indexOf("can_access_tenant_branch"),
      );
    }
  });

  it("insert tidak diubah: manager membuka atas namanya sendiri", () => {
    expect(SQL).not.toContain("create policy cervise_cash_sessions_insert");
    expect(SQL).not.toContain("create policy cervise_cash_sessions_delete");
  });

  it("tidak menghapus tabel atau kolom", () => {
    expect(SQL).not.toMatch(/drop\s+table/i);
    expect(SQL).not.toMatch(/drop\s+column/i);
  });
});
