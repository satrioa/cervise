import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260925150000_service_spareparts_status.sql"),
  "utf8",
);

function normalize(source: string) {
  return source.replace(/\s+/g, " ").toLowerCase();
}

const flat = normalize(sql);

describe("service sparepart and status migration", () => {
  it("creates the line item and stock movement tables", () => {
    expect(flat).toContain("create table if not exists public.cervise_service_spareparts");
    expect(flat).toContain("create table if not exists public.cervise_stock_movements");
    expect(flat).toContain("servis_id uuid not null references public.cervise_services(id) on delete cascade");
    expect(flat).toContain("product_id uuid not null references public.cervise_products(id) on delete restrict");
    expect(flat).toContain("qty integer not null check (qty > 0)");
    expect(flat).toContain("qty_delta integer not null check (qty_delta <> 0)");
  });

  it("adds a human readable service number", () => {
    expect(flat).toContain("alter table public.cervise_services add column if not exists service_number text");
    expect(flat).toContain("create unique index if not exists cervise_services_service_number_idx");
    expect(flat).toContain("create or replace function public.next_service_number(p_branch_id uuid)");
  });

  it("keeps client writes out of the new tables", () => {
    expect(flat).toContain("grant select on public.cervise_service_spareparts, public.cervise_stock_movements to authenticated");
    expect(flat).toContain("revoke all on public.cervise_service_spareparts, public.cervise_stock_movements from anon");
    expect(flat).not.toContain(
      "grant select, insert, update, delete on public.cervise_service_spareparts, public.cervise_stock_movements to authenticated",
    );
  });

  it("keeps the raw stock writer unreachable from clients", () => {
    expect(flat).toContain("create or replace function public.apply_stock_delta");
    expect(flat).toContain("revoke all on function public.apply_stock_delta(uuid, integer, integer, text, uuid, uuid) from authenticated");
    expect(flat).toContain("return public.apply_stock_delta(p_product_id, p_delta, p_expected_stock, p_reason, p_servis_id, p_sale_id)");
    // service flows call the internal helper, never the client-facing wrapper
    expect(flat).toContain("perform public.apply_stock_delta( v_product.id, -v_qty");
    expect(flat).toContain("perform public.apply_stock_delta( v_row.product_id, v_row.qty");
    expect(flat).not.toContain("perform public.adjust_product_stock(");
  });

  it("replaces the previous stock function so no bypass survives", () => {
    expect(flat).toContain("drop function if exists public.adjust_product_stock(uuid, integer, integer)");
    expect(flat).toContain("insert into public.cervise_stock_movements");
    expect(flat).toContain("v_product.branch_id, p_product_id, p_delta, p_reason, p_servis_id, p_sale_id, auth.uid()");
  });

  it("restricts technicians to the Dikerjakan stage", () => {
    expect(flat).toContain("create or replace function public.consume_service_spareparts");
    expect(flat).toContain("v_role = 'technician' and v_service.status <> 'dikerjakan'");
    expect(flat).toContain("raise exception 'teknisi hanya bisa memakai sparepart saat status dikerjakan'");
  });

  it("requires a reason for both cancellation decisions", () => {
    expect(flat).toContain("create or replace function public.return_service_spareparts(p_servis_id uuid, p_reason text)");
    expect(flat).toContain("create or replace function public.mark_service_spareparts_kept(p_servis_id uuid, p_reason text)");
    const reasonGuards = flat.match(/alasan wajib diisi minimal 3 karakter/g) ?? [];
    expect(reasonGuards.length).toBe(2);
  });

  it("blocks cancellation while spareparts are still consumed", () => {
    expect(flat).toContain("create or replace function public.set_service_status(p_servis_id uuid, p_status text, p_note text default null)");
    expect(flat).toContain("servis masih punya sparepart terpakai");
    expect(flat).toContain("'status_change'");
  });

  it("grants every new function to authenticated and locks out anon", () => {
    const functions = [
      "public.next_service_number(uuid)",
      "public.caller_branch_role(uuid)",
      "public.adjust_product_stock(uuid, integer, integer, text, uuid, uuid)",
      "public.consume_service_spareparts(uuid, jsonb, boolean)",
      "public.return_service_spareparts(uuid, text)",
      "public.mark_service_spareparts_kept(uuid, text)",
      "public.set_service_status(uuid, text, text)",
    ];
    for (const fn of functions) {
      expect(flat).toContain(`grant execute on function ${fn} to authenticated`);
      expect(flat).toContain(`revoke all on function ${fn} from anon`);
    }
    expect(flat.match(/security definer/g)?.length).toBeGreaterThanOrEqual(functions.length);
    expect(flat.match(/set search_path = public/g)?.length).toBeGreaterThanOrEqual(functions.length);
  });
});
