import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src", "app", "app", "servis", "actions.ts"),
  "utf8",
);

const getTeknisi = source.slice(
  source.indexOf("export async function getTeknisi"),
  source.indexOf("export async function searchCustomers"),
);

describe("sumber data dropdown teknisi", () => {
  it("membaca dari employees, bukan profiles", () => {
    expect(getTeknisi).toContain('.from("employees")');
    expect(getTeknisi).toContain('.eq("role", "TECHNICIAN")');
  });

  it("memfilter organisasi dan cabang", () => {
    expect(getTeknisi).toContain('.eq("organization_id", orgId)');
    expect(getTeknisi).toContain('.eq("branch_id", branchId)');
    expect(getTeknisi).toContain('.eq("is_active", true)');
  });

  it("tidak lagi memfilter profiles.branch_id yang selalu null", () => {
    expect(getTeknisi).not.toContain('.eq("branch_id", branchId)\n    .eq("role", "teknisi")');
    expect(getTeknisi).not.toContain('"teknisi"');
  });

  it("mengembalikan id profil, bukan id employee", () => {
    expect(getTeknisi).toContain("profiles");
    expect(getTeknisi).toContain("id: profile.id");
  });
});
