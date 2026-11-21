import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/app/pengaturan/subscription/actions.ts"),
  "utf8",
);

describe("getTenantBilling", () => {
  it("join paket memakai left join agar subscription tidak gugur saat paket non-aktif", () => {
    expect(source).toMatch(/package:packages!left\(/);
    expect(source).not.toMatch(/package:packages!inner\(/);
  });

  it("tetap menormalkan relasi paket menjadi satu objek", () => {
    expect(source).toMatch(/firstRelation\(rawSubscription\.package\)/);
  });

  it("paket lama yang tersembunyi RLS diambil lewat admin client", () => {
    expect(source).toContain('from "@/lib/supabase/admin"');
    expect(source).toMatch(/hiddenPackages\.get\(rawSubscription\.package_id/);
    expect(source).toMatch(/\.in\("id", \[\.\.\.hiddenIds\]\)/);
  });
});
