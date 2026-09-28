import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * platform_create_billing_invoice gagal dengan SQLSTATE 42702 setiap kali
 * pengguna memilih paket di /app/pengaturan/subscription. Parameter PL/pgSQL
 * bernama `invoice_type` menabrak kolom invoices.invoice_type, jadi kedua sisi
 * `=` menuliskan identifier yang sama dan PostgreSQL menolak.
 *
 * Fungsi ini menolak sebelum insert apa pun, jadi tidak ada data yang rusak -
 * tapi fitur Choosing a package mati total. Test di bawah menjaga supaya
 * qualify-nya tidak hilang dan tidak hanya diperbaiki di satu dari dua tempat.
 */

const path = resolve(
  process.cwd(),
  "supabase/migrations/20260925190000_fix_billing_invoice_ambiguous.sql",
);

const sql = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const code = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("billing invoice ambiguity fix", () => {
  it("redefines the function", () => {
    expect(code).toContain("create or replace function public.platform_create_billing_invoice(");
    expect(code).toContain("$$;");
  });

  it("has no bare `invoice_type = invoice_type` left", () => {
    // Pola inilah yang memicu 42702. Kalau muncul lagi di file ini, fitur
    // Choosing a package akan rusak lagi.
    expect(code).not.toMatch(/(?<!invoices\.)\binvoice_type\s*=\s*invoice_type\b/);
  });

  // Ada DUA query yang memakai kolom itu: pengecekan invoice yang sudah ada
  // dan penghitungan attempt. Memperbaiki satu saja akan membuat fungsi lolos
  // baris pertama lalu gagal di baris kedua.
  it("qualifies the column in both queries", () => {
    const qualified = code.match(/invoices\.invoice_type = invoice_type/g) ?? [];
    expect(qualified).toHaveLength(2);
  });

  it("keeps the right-hand side as the parameter, not the column", () => {
    // Kalau kedua sisi di-*quote* sebagai invoices.invoice_type, filternya jadi
    // selalu true dan invoice yang sudah ada tidak pernah terdeteksi.
    expect(code).not.toContain("invoices.invoice_type = invoices.invoice_type");
  });

  it("still passes the parameter into the insert", () => {
    // Nilai yang disimpan harus berasal dari argumen pemanggil ('upgrade' atau
    // 'renewal'), bukan dari kolom baris yang sedang dibaca.
    const insertValues = code.slice(code.indexOf("insert into public.invoices"));
    expect(insertValues).toContain("invoice_type,");
    expect(insertValues).not.toContain("invoices.invoice_type,");
  });

  it("leaves the literal comparison intact", () => {
    // `invoice_type = 'renewal'` tidak ambigu - sisi kanan adalah literal.
    expect(code).toContain("if invoice_type = 'renewal'");
  });
});
