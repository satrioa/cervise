import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261117140000_tenant_meta_phone_number.sql",
  ),
  "utf8",
);
const flat = sql.replace(/\s+/g, " ").toLowerCase();

describe("migrasi nomor WhatsApp per tenant", () => {
  it("menambah kolom nullable di organizations tanpa mengubah RLS", () => {
    expect(flat).toContain(
      "alter table public.organizations add column if not exists meta_phone_number_id text",
    );
    expect(flat).not.toContain("policy");
    expect(flat).not.toContain("revoke");
  });
});
