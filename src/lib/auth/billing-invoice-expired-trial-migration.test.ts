import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Dua bug di platform_create_billing_invoice membuat "Pilih paket" gagal:
 *
 * 1. `has_tenant_role()` ikut mensyaratkan langganan masih berlaku, jadi
 *    tenant yang trial-nya habis - orang yang justru perlu membayar - ditolak
 *    dengan "Tenant owner access required".
 * 2. Parameter `invoice_type` bertabrakan dengan kolom invoices.invoice_type.
 *    Mengqualify kolom saja tidak cukup; sisi kanan yang telanjang tetap
 *    ambigu (SQLSTATE 42702) dan fungsi gagal sebelum insert.
 *
 * Test ini menjaga kedua perbaikan tidak hilang saat migrasi berikutnya
 * menulis ulang fungsi yang sama.
 */

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261106120000_billing_invoice_expired_trial.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const code = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("billing invoice untuk tenant kedaluwarsa", () => {
  it("tidak memakai has_tenant_role yang mensyaratkan langganan aktif", () => {
    expect(code).not.toContain("has_tenant_role(");
  });

  it("memeriksa keanggotaan MASTER_ADMIN langsung dari employees", () => {
    expect(code).toContain("from public.employees employee");
    expect(code).toContain("employee.role = 'MASTER_ADMIN'");
    expect(code).toContain("employee.is_active = true");
    expect(code).toContain("profile.is_active = true");
  });

  it("tetap menolak non-owner", () => {
    expect(code).toContain("raise exception 'Tenant owner access required'");
  });

  it("menyelesaikan tabrakan nama invoice_type", () => {
    // Tanpa direktif ini, `invoices.invoice_type = invoice_type` tetap 42702
    // karena RHS telanjang dianggap ambigu oleh plpgsql.
    expect(code).toContain("#variable_conflict use_variable");
  });
});

/**
 * "Simpan subscription" di /owner/tenants/[id] memanggil RPC ini. Parameter
 * `custom_monthly_price` bertabrakan dengan kolom dengan nama sama, sehingga
 * setiap penyimpanan gagal sebelum UPDATE dijalankan.
 */
describe("platform_update_subscription tidak ambigu", () => {
  const updateSql = readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/20261106130000_platform_update_subscription_ambiguous.sql",
    ),
    "utf8",
  ).replace(/\r\n/g, "\n");

  it("memakai variable_conflict use_variable", () => {
    expect(updateSql).toContain("#variable_conflict use_variable");
  });

  it("mempertahankan nama parameter yang dipanggil PostgREST", () => {
    expect(updateSql).toContain("custom_monthly_price integer");
    expect(updateSql).toContain("target_grace_days integer");
  });

  it("tetap hanya untuk platform admin", () => {
    expect(updateSql).toContain("Platform admin access required");
  });
});
