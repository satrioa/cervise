import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261127120000_central_inventory_schema.sql"),
  "utf8",
);
const flat = sql.replace(/\s+/g, " ").toLowerCase();

describe("central inventory schema migration", () => {
  it("membuat tabel master pusat dan antrean request", () => {
    expect(flat).toContain("create table if not exists public.cervise_central_items");
    expect(flat).toContain("create table if not exists public.cervise_stock_requests");
  });

  it("memuat kolom kunci master pusat", () => {
    expect(flat).toContain(
      "organization_id uuid not null references public.organizations(id) on delete cascade",
    );
    expect(flat).toContain("kind text not null check (kind in ('sparepart','product'))");
    expect(flat).toContain("stock_qty integer not null default 0 check (stock_qty >= 0)");
    expect(flat).toContain("imei text");
    expect(flat).toContain("parent_key text");
  });

  it("menjaga keunikan sku dan imei master pusat", () => {
    expect(flat).toContain("cervise_central_items_sku_key");
    expect(flat).toContain("(organization_id, kind, sku) where not is_serialized");
    expect(flat).toContain("cervise_central_items_imei_key");
  });

  it("mewajibkan imei pada barang serialized", () => {
    expect(flat).toContain("where is_serialized and imei is not null");
    expect(flat).toContain(
      "cervise_central_items_serialized_imei_check check (not is_serialized or imei is not null)",
    );
  });

  it("mengamankan master pusat dengan rls select", () => {
    expect(flat).toContain("array['master_admin','admin','frontliner','technician']");
    expect(flat).toContain("grant select on public.cervise_central_items to authenticated");
  });

  it("memuat kolom dan rls antrean request", () => {
    expect(flat).toContain("decided_qty integer check (decided_qty is null or decided_qty > 0)");
    expect(flat).toContain(
      "status text not null default 'pending' check (status in ('pending','approved','rejected'))",
    );
    expect(flat).toContain("rejection_reason text");
    expect(flat).toContain("array['admin','frontliner']");
    expect(flat).toContain("array['master_admin']");
  });

  it("menautkan baris cabang dan ledger ke item pusat", () => {
    expect(flat.match(/add column if not exists central_item_id uuid/g)).toHaveLength(3);
    expect(flat).toContain("is_central_side boolean not null default false");
    expect(flat).toContain(
      "request_id uuid references public.cervise_stock_requests(id) on delete set null",
    );
  });

  it("mengizinkan alasan ledger baru", () => {
    for (const reason of ["central_purchase", "distribute", "request_in", "return_to_central"]) {
      expect(flat).toContain(`'${reason}'`);
    }
  });
});
