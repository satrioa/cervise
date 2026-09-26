import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260925122000_harden_auth_rls.sql",
);

const sql = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n")
  : "";

describe("security hardening migration", () => {
  it("restricts renewal processing to service_role", () => {
    expect(sql).toContain(
      "revoke all on function public.process_subscription_renewals() from public, anon, authenticated;",
    );
    expect(sql).toContain(
      "grant execute on function public.process_subscription_renewals() to service_role;",
    );
  });

  it("restricts direct profile security-field writes", () => {
    expect(sql).toContain(
      "revoke insert, update, delete on table public.profiles from authenticated;",
    );
    expect(sql).toContain(
      "grant update (full_name, phone, settings) on table public.profiles to authenticated;",
    );
  });

  it("adds branch organization validation and onboarding lifecycle guards", () => {
    expect(sql).toContain("validate_employee_branch_organization");
    expect(sql).toContain("has_tenant_branch_role");
    expect(sql).toContain("is_tenant_branch_member");
    expect(sql).toContain("from public.employees\n    where profile_id = v_user_id");
    expect(sql).toContain("from public.profiles\n    where id = v_user_id\n      and is_active = false");
  });
});
