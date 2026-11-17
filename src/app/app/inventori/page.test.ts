import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src", "app", "app", "inventori", "page.tsx"),
  "utf8",
);

describe("halaman inventori master admin", () => {
  it("menyembunyikan ringkasan di bawah breadcrumb untuk MASTER_ADMIN", () => {
    expect(source).toContain('import { getActiveTenant } from "@/lib/supabase/actor"');
    expect(source).toMatch(/actor\.role === "MASTER_ADMIN"\s*\?\s*undefined/);
  });

  it("tetap menampilkan ringkasan untuk peran lain", () => {
    expect(source).toMatch(/:\s*`\$\{summary\.groups\} produk induk/);
  });
});
