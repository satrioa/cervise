import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/components/inventori/product-variant-dialog.tsx"),
  "utf8",
);

/**
 * Pengaman regresi edit grup: kombinasi kartesius Warna × Storage menyisakan
 * baris phantom tanpa data. Dulu semua baris ikut divalidasi, sehingga satu
 * baris kosong membatalkan seluruh simpan (stok termasuk).
 */
describe("edit grup varian BARU", () => {
  it("melewati baris phantom yang benar-benar kosong", () => {
    expect(source).toMatch(
      /v\.stock === "" && v\.cost === "" && v\.price === "" && v\.barcode === ""/,
    );
    expect(source).toContain("? enriched.filter((c) => !isBlank(c))");
  });

  it("baris terisi tanpa ex.id tetap dibuat sebagai varian baru", () => {
    expect(source).toContain("if (isGroupEdit && c.ex?.id) {");
    expect(source).toContain("await createProductAction({");
  });

  it("update baris existing tetap menulis stok", () => {
    expect(source).toMatch(/stock_qty: Number\(v\.stock\)/);
  });
});
