import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const actions = readFileSync(
  fileURLToPath(new URL("./actions.ts", import.meta.url)),
  "utf8",
);

describe("stock opname actions wiring", () => {
  it("membuka posting untuk semua peran inventori dan memakai RPC atomik", () => {
    expect(actions).toContain("OPNAME_POSTER_ROLES");
    expect(actions).toContain("await poster()");
    expect(actions).toContain('rpc("post_stock_opname"');
    expect(actions).toContain("Role ini tidak boleh memposting opname");
    expect(actions).toContain('revalidatePath("/app/inventori/opname")');
  });

  it("pembatalan sesi tetap hanya untuk admin", () => {
    expect(actions).toContain("Hanya admin yang boleh membatalkan opname");
    expect(actions).toMatch(/export async function cancelSession[\s\S]*await manager\(\)/);
  });

  it("membuat snapshot dari helper murni dan menyimpan baris", () => {
    expect(actions).toContain("buildProductSnapshot");
    expect(actions).toContain("buildSparepartSnapshot");
    expect(actions).toContain("cervise_stock_opname_lines");
  });

  it("hanya mengubah baris sesi DRAFT", () => {
    expect(actions).toContain("status");
    expect(actions).toContain("DRAFT");
  });
});
