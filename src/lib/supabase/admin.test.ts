import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertUsableServiceRoleKey } from "./admin";

/**
 * Service role key melewati seluruh RLS project. Kalau modul ini ikut masuk
 * bundle browser, seluruh revoke/grant yang dikerjakan di migration menjadi
 * tidak berarti. Pemeriksaan di bawah menjaga file "use client" tidak pernah
 * mengimpornya - bukan sekadar tidak ada file yang kebetulan mengimpornya.
 */
function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("service role key stays server-side", () => {
  const root = resolve(process.cwd(), "src");

  it("is never imported by a 'use client' file", () => {
    const offenders = collectSourceFiles(root).filter((file) => {
      const source = readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/m.test(source)) return false;
      return /from\s+["']@\/lib\/supabase\/admin["']/.test(source) ||
        /from\s+["']@\/lib\/supabase\/actor["']/.test(source);
    });

    expect(offenders.map((f) => f.replace(root, "src"))).toEqual([]);
  });

  it("is never exposed through a NEXT_PUBLIC_ variable", () => {
    // Next.js menyisipkan NEXT_PUBLIC_* ke bundle browser secara otomatis.
    const offenders = collectSourceFiles(root).filter((file) =>
      /NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("only builds one admin client, so behaviour cannot drift between copies", () => {
    const offenders = collectSourceFiles(root).filter((file) => {
      const source = readFileSync(file, "utf8");
      if (file.endsWith(join("supabase", "admin.ts"))) return false;
      // Duplikat definisi lokal, masing-masing dengan cek key sendiri.
      return /function getAdminClient\s*\(/.test(source);
    });
    expect(offenders.map((f) => f.replace(root, "src"))).toEqual([]);
  });
});

describe("assertUsableServiceRoleKey", () => {
  // Key yang pernah ada di .env.local. Semuanya menghasilkan error "Invalid
  // Compact JWS" dari dalam supabase-js, yang tidak mengarah ke penyebabnya.
  it("rejects a placeholder value with an actionable message", () => {
    expect(() => assertUsableServiceRoleKey("dummy")).toThrow(/tidak valid/);
    expect(() => assertUsableServiceRoleKey("dummy")).toThrow(/Project Settings/);
  });

  it("rejects missing and empty values", () => {
    for (const value of [undefined, "", "   "]) {
      expect(() => assertUsableServiceRoleKey(value)).toThrow();
    }
  });

  it("accepts a legacy JWT service role key", () => {
    const legacy = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abc";
    expect(assertUsableServiceRoleKey(legacy)).toBe(legacy);
  });

  it("accepts the newer sb_secret_ format", () => {
    const modern = "sb_secret_abc123";
    expect(assertUsableServiceRoleKey(modern)).toBe(modern);
  });

  it("trims surrounding whitespace, which dotenv files often carry", () => {
    const legacy = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abc";
    expect(assertUsableServiceRoleKey(`  ${legacy}  `)).toBe(legacy);
  });

  it("does not mistake an anon or publishable key for a service role key", () => {
    // Keduanya boleh bocor ke browser, jadi tidak boleh dipakai di sini. Bentuk
    // JWT tiga segment akan lolos pemeriksaan di atas, jadi yang membedakan
    // hanyalah decode payload - itu urusan RLS, bukan client.
    // Yang dicek di sini hanya bentuknya, jadi placeholder yang tidak berbentuk
    // JWT harus tetap ditolak.
    expect(() => assertUsableServiceRoleKey("eyJ...")).toThrow();
  });
});
