import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260925180000_add_photo_urls.sql",
);

const sql = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n")
  : "";

// Komentar sering menyebut "grant update" saat menjelaskan kenapa sebuah
// statement TIDAK ada. Assertion di bawah harus melihat SQL saja.
const sqlOnly = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("photo url migration", () => {
  it("adds a photo column for accounts and a logo column for tenants", () => {
    expect(sql).toContain(
      "alter table public.profiles add column if not exists avatar_url text;",
    );
    expect(sql).toContain(
      "alter table public.organizations add column if not exists logo_url text;",
    );
  });

  it("creates a public bucket capped at 2MB and image types only", () => {
    expect(sql).toContain("insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)");
    expect(sql).toContain("'cervise-photos'");
    // public = true, because the bucket is read via getPublicUrl without a
    // session. Safety comes from unguessable filenames, not from secrecy.
    expect(sql).toMatch(/insert into storage\.buckets[\s\S]*?\n\s*true,/);
    expect(sql).toContain("2097152");
    expect(sql).toContain("array['image/jpeg', 'image/png', 'image/webp']::text[]");
  });

  // The whole security posture of this bucket is "no direct browser access".
  // If someone later adds a storage.objects policy for these names, uploads
  // would become reachable straight from the browser, bypassing the ownership
  // checks in the server actions. This test is the guard for that.
  it("leaves no storage.objects policy for direct client writes", () => {
    expect(sql).toContain('drop policy if exists "cervise photos insert" on storage.objects;');
    expect(sql).toContain('drop policy if exists "cervise photos update" on storage.objects;');
    expect(sql).toContain('drop policy if exists "cervise photos delete" on storage.objects;');

    expect(sqlOnly).not.toMatch(/create policy[^;]*on storage\.objects/i);
  });

  // The hardening migration deliberately locks organizations and profiles down
  // to a specific column list. Adding avatar_url to that list would widen what
  // a signed-in browser session can write, so the new columns must be written
  // through service role instead.
  it("does not widen the hardened column grants", () => {
    expect(sqlOnly).not.toMatch(/grant\s+update/i);
    expect(sqlOnly).not.toMatch(/revoke\s+insert,\s*update,\s*delete/i);
  });
});
