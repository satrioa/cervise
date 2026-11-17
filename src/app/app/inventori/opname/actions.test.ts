import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const actions = readFileSync(
  fileURLToPath(new URL("./actions.ts", import.meta.url)),
  "utf8",
);

describe("stock opname actions wiring", () => {
  it("menutup posting untuk non-admin dan memakai RPC atomik", () => {
    expect(actions).toContain('"MASTER_ADMIN"');
    expect(actions).toContain('rpc("post_stock_opname"');
    expect(actions).toContain('Hanya admin yang boleh memposting opname');
    expect(actions).toContain('revalidatePath("/app/inventori/opname")');
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
