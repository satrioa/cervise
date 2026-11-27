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
});
