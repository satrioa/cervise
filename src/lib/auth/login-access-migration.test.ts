import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261022094942_login_access_gate.sql"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("login access gate migration", () => {
  it("menjaga RLS tetap ketat untuk tenant expired", () => {
    // is_tenant_member tidak boleh berubah menjadi "cukup anggota"; status
    // langganan harus tetap jadi syarat supaya data tenant expired tidak bocor.
    expect(sql).toContain("public.is_tenant_subscription_active(check_organization_id)");
    expect(sql).toContain("create or replace function public.is_tenant_member");
  });

  it("membedakan member dan owner dari tenant yang tidak aktif", () => {
    expect(sql).toContain("create or replace function public.get_my_login_access()");
    expect(sql).toContain("'has_membership_record'");
    expect(sql).toContain("'has_inactive_ownership'");
    expect(sql).toContain("organization.owner_profile_id = (select user_id from me)");
  });

  it("hanya memberi akses fungsi status ke user login", () => {
    expect(sql).toContain("revoke all on function public.get_my_login_access() from public, anon;");
    expect(sql).toContain("grant execute on function public.get_my_login_access() to authenticated;");
  });

  it("menutup pembuatan tenant untuk owner yang baris employee-nya hilang", () => {
    expect(sql).toContain("where owner_profile_id = v_user_id");
  });
});
