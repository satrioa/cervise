import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("brand Kaggo", () => {
  it("dipakai di metadata, manifest, dan nama paket", () => {
    expect(read("src/app/layout.tsx")).toContain("Kaggo — Manajemen Servis Gadget Multibranch");
    expect(read("public/manifest.json")).toContain('"short_name": "Kaggo"');
    expect(JSON.parse(read("package.json")).name).toBe("kaggo");
    expect(JSON.parse(read("package-lock.json")).name).toBe("kaggo");
  });

  it("identifier teknis tetap cervise sesuai allowlist", () => {
    expect(read("wrangler.jsonc")).toContain('"name": "cervise"');
    expect(read("src/lib/format.ts")).toContain('"cervise-locale"');
    expect(read("src/app/app/inventori/actions.ts")).toContain("cervise_products");
  });
});
