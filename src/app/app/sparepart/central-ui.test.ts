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

  it("admin dan frontliner bisa request stok, master dan technician tidak", () => {
    const page = read("src/app/app/sparepart/page.tsx");
    expect(page).toContain('["ADMIN", "FRONTLINER"].includes(actor.role)');
    expect(page).toContain("canRequest={canRequest}");
    expect(page).not.toContain("canManage");

    const ui = read("src/app/app/sparepart/sparepart-client.tsx");
    expect(ui).toContain("canRequest: boolean");
    expect(ui).toContain('scope === "branch" && canRequest &&');
    expect(ui).not.toContain("canManage");
  });

  it("toggle scope hanya master admin dan stok pusat tidak diambil cabang", () => {
    const ui = read("src/app/app/sparepart/sparepart-client.tsx");
    expect(ui).toMatch(/\{isMasterAdmin && \(\s*<Tabs/);
    expect(ui).toContain('from "@/components/ui/tabs"');
    expect(ui).not.toContain("ToggleGroup");
    expect(ui).toMatch(/if \(isMasterAdmin\) \{\s*const \[branchRows, centralRows\] = await Promise\.all\(\[listSpareparts\(term\), listCentralItems\(term\)\]\)/);
    expect(ui.match(/listCentralItems\(term\)/g) ?? []).toHaveLength(1);
  });

  it("dialog distribusi mendukung batch, preview, dan tabel yang tidak melebar", () => {
    const dlg = read("src/components/sparepart/central-stock-dialogs.tsx");
    expect(dlg).toContain("distributeCentralItemsBatch");
    expect(dlg).toContain("max-h-[90vh]");
    expect(dlg).toContain("overflow-y-auto");
    expect(dlg).toContain("overflow-x-auto");
    expect(dlg).toContain("min-w-[420px]");
    expect(dlg.match(/Lanjut ke Preview/g) ?? []).toHaveLength(1);
    expect(dlg).toContain("Kembali");
    expect(dlg).toContain("Konfirmasi");
    expect(dlg).toContain("!item.is_serialized");
    expect(dlg).toContain("Stok gudang");
    expect(dlg).toContain("Item ini sudah ada di daftar");
    expect(dlg).toContain("onClick={confirmBatch}");
    expect(dlg).toContain("disabled={saving}");
    expect(dlg).toContain("const liveRows = batchRows.map(");
    expect(dlg).toContain("items.find((item) => item.id === row.id)?.stock_qty");
    expect(dlg).toContain("{liveRows.map((row) => (");
    expect(dlg).toContain('aria-live="polite"');
    expect(dlg).toContain("min-h-11 min-w-11");
    expect(dlg).toContain("if (saving) return;");
  });

  it("preview membekukan snapshot stok untuk konfirmasi batch", () => {
    const dlg = read("src/components/sparepart/central-stock-dialogs.tsx");
    expect(dlg).toContain("const [previewRows, setPreviewRows] = useState<BatchRow[]>([])");
    expect(dlg).toContain("setPreviewRows(liveRows)");
    expect(dlg).toContain("items: previewRows.map(");
    expect(dlg).toContain("{previewRows.map((row) => (");
    expect(dlg).toContain("setPreviewRows([])");
  });

  it("unit serialized tetap punya dialog distribusi tersendiri", () => {
    const dlg = read("src/components/sparepart/central-stock-dialogs.tsx");
    expect(dlg).toContain('"distribute-serial"');
    expect(dlg).toContain("Distribusi Unit Serial");
    const ui = read("src/app/app/sparepart/sparepart-client.tsx");
    expect(ui).toContain("Distribusi Unit (IMEI)");
    expect(ui.match(/setDialogMode\("distribute-serial"\)/g) ?? []).toHaveLength(2);
  });

  it("batch gagal me-reload daftar tanpa menutup dialog", () => {
    expect(read("src/components/sparepart/central-stock-dialogs.tsx")).toContain("onReload()");
    expect(read("src/app/app/sparepart/sparepart-client.tsx")).toContain("onReload={() => void reload()}");
  });
});
