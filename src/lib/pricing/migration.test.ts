import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261119140000_pricing_v2.sql"),
  "utf8",
);

describe("migration pricing v2", () => {
  it("menambahkan konfigurasi paket tanpa menghapus paket lama", () => {
    for (const column of [
      "annual_price",
      "trial_days",
      "ticket_quota",
      "whatsapp_quota",
      "extra_branch_price",
      "extra_employee_price",
      "extra_ticket_block_price",
      "ticket_block_size",
      "wa_per_ticket_block",
      "is_recommended",
    ]) {
      expect(sql, column).toMatch(new RegExp(`add column if not exists ${column}`));
    }
    expect(sql).toContain("set is_active = false where code in ('basic', 'pro')");
    expect(sql).not.toMatch(/delete from public\.packages/);
  });

  it("trial mengikuti konfigurasi", () => {
    expect(sql).toContain("make_interval(days => trial_days)");
    expect(sql).not.toContain("interval '14 days'");
  });

  it("kuota periodik per tenant punya RPC atomik", () => {
    expect(sql).toContain("primary key (organization_id, period_start)");
    expect(sql).toContain("function public.reserve_service_ticket");
    expect(sql).toContain("function public.consume_wa_quota");
    expect(sql).toContain("function public.check_wa_quota");
    expect(sql).toContain("public.is_tenant_member(p_organization_id)");
  });

  it("tabel usage hanya bisa diakses service_role", () => {
    expect(sql).toContain("alter table public.organization_usage enable row level security");
    expect(sql).toContain("revoke all on table public.organization_usage from anon, authenticated");
    expect(sql).toContain("grant all on table public.organization_usage to service_role");
  });
});
