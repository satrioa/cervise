import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  "supabase/migrations/20261018100000_technician_write_rls.sql",
  "utf8",
);

const WRITE_ROLES =
  "array['MASTER_ADMIN'::text, 'ADMIN'::text, 'FRONTLINER'::text, 'TECHNICIAN'::text]";

function policyBody(policy: string): string {
  const start = SQL.indexOf(`create policy ${policy} on`);
  expect(start, `${policy} harus dibuat ulang`).toBeGreaterThanOrEqual(0);
  const end = SQL.indexOf(";", start);
  return SQL.slice(start, end);
}

describe("teknisi boleh menulis servis dan customer di cabangnya sendiri", () => {
  /**
   * Alasan migrasi ini ada: dashboard teknisi punya tombol "Servis baru" dan
   * `manifest.ts` memberi akses `/app/servis` ke TECHNICIAN, tapi INSERT ditolak
   * RLS. Test di bawah mengunci daftar role per policy supaya tidak kembali
   * tightened tanpa sengaja.
   */
  it("menambahkan TECHNICIAN ke policy insert customers dan services", () => {
    expect(policyBody("cervise_customers_insert")).toContain(WRITE_ROLES);
    expect(policyBody("cervise_services_insert")).toContain(WRITE_ROLES);
  });

  it("tetap memakai can_access_tenant_branch, jadi hanya cabang sendiri", () => {
    for (const policy of [
      "cervise_customers_insert",
      "cervise_services_insert",
      "cervise_customers_update",
      "cervise_services_update",
    ]) {
      expect(policyBody(policy)).toContain("public.can_access_tenant_branch(");
    }
  });

  it("memberi teknisi UPDATE karena createServis menulis customer lama", () => {
    // `createServis` melakukan upsert ke customer yang sudah ada sebelum membuat
    // servis. Tanpa UPDATE, servis kedua untuk customer sama gagal walau INSERT
    // lolos.
    expect(policyBody("cervise_customers_update")).toContain(WRITE_ROLES);
    expect(policyBody("cervise_services_update")).toContain(WRITE_ROLES);
  });

  it("TIDAK melonggarkan hapus servis - itu tetap admin", () => {
    expect(SQL).not.toContain("cervise_services_delete on");
    expect(SQL).not.toContain("cervise_customers_delete on");
  });

  it("membuka log, tag, dan kelengkapan karena form create-servis menulis semuanya", () => {
    expect(policyBody("cervise_service_logs_insert")).toContain(WRITE_ROLES);
    expect(policyBody("cervise_service_tags_write")).toContain(WRITE_ROLES);
    expect(policyBody("cervise_kelengkapan_options_write")).toContain(WRITE_ROLES);
  });

  it("drop policy lama sebelum membuat yang baru, supaya tidak menumpuk", () => {
    const drops = SQL.match(/drop policy if exists/g) ?? [];
    const creates = SQL.match(/create policy/g) ?? [];
    expect(drops.length).toBe(creates.length);
  });
});