import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/inventori/inventori-import-dialog.tsx"),
  "utf8",
);

describe("impor inventori", () => {
  it("memulihkan server action yang kedaluwarsa setelah deploy", () => {
    // Bundle lama menyimpan ID action dari build sebelumnya. Tanpa pemulihan,
    // impor gagal dengan "Server Action ... was not found on the server".
    expect(source).toContain("was not found on the server");
    expect(source).toContain("window.location.reload()");
  });

  it("template tidak mengisi kolom tipe", () => {
    // Tipe sudah tercermin dari nama sheet, jadi sampel template tidak boleh
    // menyisipkan nilai BARU/BEKAS di kolom keempat lagi.
    const template = source.slice(source.indexOf("function downloadTemplate"), source.indexOf("export function InventoriImportDialog"));
    expect(template).not.toMatch(/"BARU"|"BEKAS"/);
  });
});
