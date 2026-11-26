import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261126110000_custom_service_sparepart.sql"),
  "utf8",
);
const flat = sql.replace(/\s+/g, " ").toLowerCase();

describe("sparepart custom migration", () => {
  it("menandai baris custom dan tidak menyentuh stok", () => {
    expect(flat).toContain("add column if not exists is_custom boolean not null default false");
    expect(flat).toContain("1, v_cost, v_cost, v_cost, auth.uid(), true");
    expect(flat).toContain("if v_row.is_custom then null;");
  });

  it("mencatat biaya sebagai pengeluaran finansial", () => {
    expect(flat).toContain("'pengeluaran', v_cost");
    expect(flat).toContain("'sparepart custom ' || v_name");
    expect(flat).toContain("auth.uid(), 'transaksi'");
  });

  it("mengamankan RPC dari anon", () => {
    expect(flat).toContain("create or replace function public.consume_custom_service_sparepart");
    expect(flat).toContain("revoke all on function public.consume_custom_service_sparepart");
    expect(flat).toContain("grant execute on function public.consume_custom_service_sparepart");
  });
});
