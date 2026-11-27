import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("halaman sparepart gudang pusat", () => {
  it("menerima flag master admin", () => {
    expect(read("src/app/app/sparepart/page.tsx")).toContain("isMasterAdmin={isMasterAdmin}");
  });

  it("memiliki toggle scope pusat/cabang dan tombol request", () => {
    const ui = read("src/app/app/sparepart/sparepart-client.tsx");
    expect(ui).toContain('value="central"');
    expect(ui).toContain('value="branch"');
    expect(ui).toContain("Request Stok");
    expect(ui).not.toContain("Tambah Sparepart");
  });

  it("hanya master admin yang melihat tab approve", () => {
    const ui = read("src/app/app/sparepart/sparepart-client.tsx");
    expect(ui).toContain("isMasterAdmin &&");
    expect(ui).toContain("Approve Request");
  });

  it("frontliner bisa request stok, technician tidak", () => {
    const page = read("src/app/app/sparepart/page.tsx");
    expect(page).toContain('["MASTER_ADMIN", "ADMIN", "FRONTLINER"].includes(actor.role)');
    expect(page).toContain("canRequest={canRequest}");

    const ui = read("src/app/app/sparepart/sparepart-client.tsx");
    expect(ui).toContain("canRequest: boolean");
    expect(ui).toContain('scope === "branch" && canRequest &&');
    expect(ui).not.toContain('scope === "branch" && canManage &&');
  });

  it("toggle scope hanya master admin dan stok pusat tidak diambil cabang", () => {
    const ui = read("src/app/app/sparepart/sparepart-client.tsx");
    expect(ui).toMatch(/\{isMasterAdmin && \(\s*<ToggleGroup/);
    expect(ui).toMatch(/if \(isMasterAdmin\) \{\s*const \[branchRows, centralRows\] = await Promise\.all\(\[listSpareparts\(term\), listCentralItems\(term\)\]\)/);
    expect(ui.match(/listCentralItems\(term\)/g) ?? []).toHaveLength(1);
  });
});
