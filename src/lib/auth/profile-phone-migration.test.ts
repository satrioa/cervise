import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260925210000_profile_phone_validation.sql",
  ),
  "utf8",
);

const flat = sql.replace(/\s+/g, " ").toLowerCase();

describe("profile phone validation migration", () => {
  it("menegakkan format nomor di database", () => {
    expect(flat).toContain("add constraint profiles_phone_charset");
    expect(flat).toContain("length(phone) <= 24");
    expect(flat).toContain("phone ~ '^[0-9+\\-\\s()]+$'");
  });

  it("membiarkan nomor kosong tetap sah", () => {
    expect(flat).toContain("phone is null or");
  });

  it("tidak menambah kolom nomor ke employees", () => {
    expect(flat).not.toContain("alter table public.employees");
  });

  it("tidak mengubah grant self-service", () => {
    expect(flat).not.toContain("grant");
    expect(flat).not.toContain("revoke");
  });

  it("tidak menyentuh tabel lain", () => {
    expect(flat).not.toContain("create policy");
    expect(flat).not.toContain("drop policy");
    expect(flat).not.toContain("create table");
  });
});
