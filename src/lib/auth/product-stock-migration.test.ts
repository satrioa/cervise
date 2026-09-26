import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "supabase", "migrations");
const stockMigration = readFileSync(join(root, "20260925140000_lock_product_stock.sql"), "utf8");
const operationalMigration = readFileSync(join(root, "20260925130000_cervise_operational_schema.sql"), "utf8");

function normalize(sql: string) {
  return sql.replace(/\s+/g, " ").toLowerCase();
}

describe("product stock write hardening", () => {
  it("restricts product updates to manager roles", () => {
    const sql = normalize(stockMigration);
    expect(sql).toContain("create policy cervise_products_update_manager_only");
    expect(sql).toContain("has_tenant_branch_role(organization_id, branch_id, array['master_admin'::text, 'admin'::text])");
    expect(sql).not.toMatch(/create policy cervise_products_update[\s\S]{0,400}is_tenant_branch_member/);
  });

  it("removes stock_qty from client writable columns", () => {
    const sql = normalize(stockMigration);
    expect(sql).toContain("revoke update on table public.cervise_products from authenticated");
    const grantMatch = sql.match(/grant update \(([^)]*)\) on table public\.cervise_products to authenticated/);
    expect(grantMatch).not.toBeNull();
    expect(grantMatch?.[1]).not.toContain("stock_qty");
    expect(grantMatch?.[1]).not.toContain("organization_id");
    expect(grantMatch?.[1]).not.toContain("branch_id");
  });

  it("exposes a validated security definer stock function", () => {
    const sql = normalize(stockMigration);
    expect(sql).toContain("create or replace function public.adjust_product_stock");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
    expect(sql).toContain("grant execute on function public.adjust_product_stock");
    expect(sql).toContain("revoke all on function public.adjust_product_stock(uuid, integer, integer) from anon");
    expect(sql).toContain("revoke all on function public.adjust_product_stock(uuid, integer, integer) from public");
  });

  it("keeps compatibility views read only", () => {
    const operational = normalize(operationalMigration);
    expect(operational).toContain("revoke insert, update, delete on public.cervise_branches, public.cervise_finance_tx, public.cervise_spareparts from authenticated");
    expect(operational).not.toContain("grant select, insert, update, delete on public.cervise_branches");
    expect(normalize(stockMigration)).toContain("revoke insert, update, delete on public.cervise_branches, public.cervise_finance_tx, public.cervise_spareparts from authenticated");
    expect(normalize(stockMigration)).toContain("revoke all on public.cervise_branches, public.cervise_finance_tx, public.cervise_spareparts from anon");
    expect(normalize(stockMigration)).toContain("grant select on public.cervise_branches, public.cervise_finance_tx, public.cervise_spareparts to authenticated, service_role");
  });
});
