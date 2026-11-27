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

  it("menautkan baris cabang dan ledger ke item pusat", () => {
    expect(flat.match(/add column if not exists central_item_id uuid/g)).toHaveLength(3);
    expect(flat).toContain("is_central_side boolean not null default false");
  });

  it("mengizinkan alasan ledger baru", () => {
    for (const reason of ["central_purchase", "distribute", "request_in", "return_to_central"]) {
      expect(flat).toContain(`'${reason}'`);
    }
  });
});
