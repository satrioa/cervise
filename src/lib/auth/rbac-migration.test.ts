import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SQL = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260925220000_add_role_scoped_policies.sql",
  ),
  "utf8",
);

/** Whitespace dinormalkan supaya pencocokan tahan format ulang. */
const FLAT = SQL.replace(/\s+/g, " ");

/**
 * Test ini memeriksa isi migration, bukan hasil eksekusinya — suite berjalan
 * tanpa database. Pola yang sama dipakai `src/lib/auth/security-migration.test.ts`
 * dan `src/lib/auth/photo-migration.test.ts`.
 *
 * Sebuah policy adalah satu statement SQL yang diakhiri `;`; tidak ada `;` di
 * dalam-bodied policy seperti `exists ( select 1 ... )`, jadi memotong sampai
 * titik koma pertama aman.
 */
function policyBody(
  policy: string,
  action: "insert" | "update" | "delete" | "select",
): string {
  const anchor = `create policy ${policy} on public.`;
  const start = FLAT.indexOf(anchor);
  expect(start, `policy ${policy} harus ada`).toBeGreaterThanOrEqual(0);

  const actionAt = FLAT.indexOf(`for ${action} to authenticated`, start);
  expect(
    actionAt,
    `policy ${policy} harus punya "for ${action} to authenticated"`,
  ).toBeGreaterThanOrEqual(0);

  const terminator = FLAT.indexOf(";", actionAt);
  expect(terminator, `policy ${policy} harus diakhiri titik koma`).toBeGreaterThan(actionAt);

  return FLAT.slice(actionAt, terminator + 1);
}

describe("employees", () => {
  it("ketiga policy write membolehkan ADMIN", () => {
    for (const action of ["insert", "update", "delete"] as const) {
      const body = policyBody("employees_" + action, action);
      expect(body).toContain("caller.role = 'ADMIN'");
    }
  });

  it("ketiga policy write menyaring branch milik target", () => {
    for (const action of ["insert", "update", "delete"] as const) {
      const body = policyBody("employees_" + action, action);
      expect(body).toContain("caller.branch_id = employees.branch_id");
      expect(body).toContain("caller.organization_id = employees.organization_id");
    }
  });

  it("ADMIN hanya boleh bertindak pada cabangnya sendiri", () => {
    const body = policyBody("employees_update", "update");
    expect(body).toMatch(/caller\.profile_id = auth\.uid\(\)/);
    expect(body).toMatch(/caller\.is_active/);
  });

  it("policy update punya with check", () => {
    const body = policyBody("employees_update", "update");
    expect(body).toContain("with check");
  });

  it("MASTER_ADMIN tetap diterima lewat has_tenant_role", () => {
    for (const action of ["insert", "update", "delete"] as const) {
      const body = policyBody("employees_" + action, action);
      expect(body).toContain("has_tenant_role(organization_id, array['MASTER_ADMIN']::text[])");
    }
  });
});

describe("branches", () => {
  it("ADMIN dicabut dari branches_update", () => {
    const body = policyBody("branches_update", "update");
    expect(body).not.toContain("'ADMIN'");
    expect(body).toContain("has_tenant_role(organization_id, array['MASTER_ADMIN']::text[])");
  });
});

describe("cervise_products", () => {
  it("insert, update, delete mengizinkan keempat role", () => {
    for (const action of ["insert", "update", "delete"] as const) {
      const body = policyBody("cervise_products_" + action, action);
      for (const role of ["MASTER_ADMIN", "ADMIN", "FRONTLINER", "TECHNICIAN"]) {
        expect(body).toContain(`'${role}'`);
      }
    }
  });

  it("update tidak lagi manager-only — kunci 20260925140000 dilonggarkan", () => {
    const body = policyBody("cervise_products_update", "update");
    for (const role of ["FRONTLINER", "TECHNICIAN"]) {
      expect(body).toMatch(new RegExp(`array\\[[^\\]]*'${role}'`));
    }
  });

  it("semua policy write memakai has_tenant_branch_role dengan organization_id dan branch_id", () => {
    for (const action of ["insert", "update", "delete"] as const) {
      const body = policyBody("cervise_products_" + action, action);
      expect(body).toContain("has_tenant_branch_role(organization_id, branch_id");
    }
  });

  it("stock_qty tetap tidak diberi hak update langsung", () => {
    const grantMatch = FLAT.match(
      /grant update \(([^)]*)\) on table public\.cervise_products to authenticated/i,
    );
    expect(grantMatch).not.toBeNull();
    const columns = (grantMatch?.[1] ?? "").toLowerCase();
    expect(columns).not.toContain("stock_qty");
    expect(columns).toContain("sku");
  });

  it("policy update punya with check", () => {
    expect(policyBody("cervise_products_update", "update")).toContain("with check");
  });
});

describe("cervise_sparepart_categories", () => {
  it("insert, update, delete membolehkan TECHNICIAN", () => {
    for (const action of ["insert", "update", "delete"] as const) {
      const body = policyBody("cervise_sparepart_categories_" + action, action);
      expect(body).toContain("'TECHNICIAN'");
    }
  });

  it("FRONTLINER tetap ditolak dari master kategori", () => {
    for (const action of ["insert", "update", "delete"] as const) {
      const body = policyBody("cervise_sparepart_categories_" + action, action);
      expect(body).not.toContain("'FRONTLINER'");
    }
  });
});

describe("adjust_product_stock", () => {
  const fn = SQL.slice(SQL.indexOf("create or replace function public.adjust_product_stock"));

  it("mendefinisikan ulang fungsi dengan role TECHNICIAN", () => {
    expect(fn).toContain("create or replace function public.adjust_product_stock");
  });

  it("cek role di dalam SECURITY DEFINER mengizinkan TECHNICIAN", () => {
    const roles = fn.slice(0, fn.indexOf("raise exception 'role tidak diizinkan"));
    for (const role of ["MASTER_ADMIN", "ADMIN", "FRONTLINER", "TECHNICIAN"]) {
      expect(roles).toContain(`'${role}'::text`);
    }
  });

  it("tetap menolak stok negatif", () => {
    expect(fn).toContain("raise exception 'stok tidak cukup'");
  });

  it("tetap hanya revoke dari anon, grant ke authenticated", () => {
    expect(fn).toContain("revoke all on function public.adjust_product_stock(uuid, integer, integer) from anon");
    expect(fn).toContain("grant execute on function public.adjust_product_stock(uuid, integer, integer) to authenticated");
  });
});

describe("bentuk migration", () => {
  it("menyebut spec sumber di komentar", () => {
    expect(SQL).toContain("2026-09-28-role-scoped-access-admin-design.md");
  });

  it("tidak ada REVOKE yang mencabut akses baru", () => {
    expect(SQL).not.toMatch(/revoke\s+insert,\s*update,\s*delete\s+on\s+table\s+public\.cervise_products/i);
  });
});
