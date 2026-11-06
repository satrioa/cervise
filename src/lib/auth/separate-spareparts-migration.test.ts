import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261104090000_separate_spareparts.sql"),
  "utf8",
);

const flat = sql.replace(/\s+/g, " ").toLowerCase();

describe("separate spareparts migration", () => {
  it("replaces the compatibility view with a real branch-scoped table", () => {
    expect(flat).toContain("drop view if exists public.cervise_spareparts");
    expect(flat).toContain("create table if not exists public.cervise_spareparts");
    expect(flat).toContain("unique (branch_id, sku)");
  });

  it("backfills sparepart categories and hides the source products", () => {
    expect(flat).toContain("from public.cervise_sparepart_categories c");
    expect(flat).toContain("on conflict (branch_id, sku) do nothing");
    expect(flat).toContain("update public.cervise_products p set is_active = false");
  });

  it("keeps stock changes behind RPCs and inside the ledger", () => {
    expect(flat).toContain("create or replace function public.apply_sparepart_stock_delta");
    expect(flat).toContain("revoke all on function public.apply_sparepart_stock_delta");
    expect(flat).toContain("create or replace function public.adjust_sparepart_stock");
    expect(flat).toContain("insert into public.cervise_stock_movements ( branch_id, sparepart_id");
  });

  it("consumes and returns sparepart stock instead of product stock", () => {
    expect(flat).toContain("from public.cervise_spareparts where id = v_sparepart_id and branch_id = v_service.branch_id");
    expect(flat).toContain("perform public.apply_sparepart_stock_delta( v_part.id, -v_qty");
    expect(flat).toContain("if v_row.sparepart_id is not null then");
    // Baris lama yang masih menunjuk produk tetap bisa dikembalikan.
    expect(flat).toContain("perform public.apply_stock_delta( v_row.product_id, v_row.qty");
  });
});
