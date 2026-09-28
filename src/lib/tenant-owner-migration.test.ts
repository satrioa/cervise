import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Kolom owner_profile_id holds jawaban untuk "siapa yang memiliki tenant ini",
 * yang sebelumnya tidak punya sumber yang jujur: hanya created_by (yang antara
 * "yang membuat" dan "yang membeli" tercampur) dan employees.role =
 * MASTER_ADMIN (yang berarti operational, bukan kepemilikan).
 *
 * Kolom ini sengaja diisi lewat trigger, bukan menyalin ulang dua fungsi
 * pembuatan tenant yang panjang. Test di bawah menjaga trigger itu ada dan
 * hanya berlaku saat insert - kalau ikut jalan saat update, setiap perubahan
 * created_by akan diam-diam memindahkan kepemilikan, padahal keputusan proyek
 * ini ownership tidak bisa dipindahkan.
 */

const path = resolve(process.cwd(), "supabase/migrations/20260925300000_add_tenant_owner.sql");
const sql = readFileSync(path, "utf8").replace(/\r\n/g, "\n");

describe("migration owner_profile_id", () => {
  it("menambahkan kolom sebagai foreign key ke auth.users", () => {
    expect(sql).toContain("add column if not exists owner_profile_id uuid");
    expect(sql).toMatch(/references auth\.users\(id\)/);
  });

  it("backfill dari created_by, yang di dua jalur pembuatan sudah bernilai pemilik", () => {
    expect(sql).toMatch(/update public\.organizations\s+set owner_profile_id = created_by/);
    expect(sql).toMatch(/where owner_profile_id is null\s+and created_by is not null/);
  });

  it("tidak menimpa pemilik yang sudah tercatat", () => {
    // Kalau backfill tidak dibatasi null, tenant yang somehow sudah punya
    // owner_profile_id akan ditimpa diam-diam.
    const backfill = sql.slice(sql.indexOf("update public.organizations"));
    expect(backfill.slice(0, 300)).toContain("where owner_profile_id is null");
  });

  it("mengisi pemilik lewat trigger, bukan menyalin ulang fungsi pembuatan tenant", () => {
    expect(sql).toContain("create or replace function public.set_tenant_owner_on_insert()");
    expect(sql).toContain("before insert on public.organizations");
    // Kalau trigger ikut pada update, perubahan created_by = perpindahan
    // kepemilikan yang tidak disengaja.
    expect(sql).not.toMatch(/before insert or update/i);
    expect(sql).not.toMatch(/before update/i);
  });

  it("hanya mengisi saat kolom masih kosong", () => {
    expect(sql).toMatch(/if new\.owner_profile_id is null and new\.created_by is not null then/);
  });

  it("trigger punya search_path terkunci, bukan role mutable", () => {
    // Tanpa ini advisor keamanan menandai function_search_path_mutable: search_path
    // yang bisa berubah per role memungkinkan objek berbahaya disisipkan di
    // depan resolusi nama.
    const triggerFn = sql.slice(sql.indexOf("create or replace function public.set_tenant_owner_on_insert"));
    expect(triggerFn.slice(0, 260)).toMatch(/set search_path = public/);
  });

  it("menyediakan helper is_tenant_owner untuk RLS", () => {
    expect(sql).toContain("create or replace function public.is_tenant_owner(");
    expect(sql).toMatch(/owner_profile_id = check_user_id/);
    // security definer + search_path terkunci, mengikuti pola has_tenant_role.
    expect(sql).toMatch(/security definer\s+set search_path = public/);
  });

  it("mengunci ACL: authenticated boleh, anon tidak", () => {
    // Supabase memberi EXECUTE ke anon untuk fungsi baru di schema public.
    // "revoke from public" saja tidak cukup karena grant eksplisit ke anon
    // tetap ada - tanpa ini, siapa pun tanpa login bisa menebak profil mana
    // yang memiliki tenant mana.
    expect(sql).toMatch(
      /revoke execute on function public\.is_tenant_owner\(uuid, uuid\) from public, anon, authenticated/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.is_tenant_owner\(uuid, uuid\) to authenticated, service_role/,
    );
    // Bentuk lama hanya "revoke all ... from public" dan tidak menutup anon.
    expect(sql).not.toMatch(/revoke all on function public\.is_tenant_owner/);
  });

  it("policy select tetap memberi akses kepada semua jalur yang sudah ada", () => {
    const policy = sql.slice(sql.lastIndexOf("create policy organizations_select"));
    // Menulis ulang policy tanpa mempertahankan cabang yang lama akan
    // memutus platform admin dan anggota tenant yang sekarang jalan.
    expect(policy).toContain("public.is_platform_admin()");
    expect(policy).toContain("public.is_tenant_member(id)");
    expect(policy).toContain("created_by = auth.uid()");
    expect(policy).toContain("public.is_tenant_owner(id)");
  });
});
