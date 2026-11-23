import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("aksi kondisi awal tidak memunculkan React error #441", () => {
  for (const file of [
    "src/components/servis/servis-form.tsx",
    "src/components/servis/edit-servis-form.tsx",
  ]) {
    it(`${file} menangani error updateKondisiAwal`, () => {
      const source = read(file);
      const at = source.indexOf("updateKondisiAwal(");
      expect(at, `${file}: tidak memanggil updateKondisiAwal`).toBeGreaterThan(-1);
      const call = source.slice(Math.max(0, at - 120), at + 120);
      expect(call).toContain("try {");
      expect(call).toContain("catch (error)");
      expect(source).toContain('toast.error(error instanceof Error ? error.message : "Gagal menyimpan kondisi awal")');
    });
  }

  it("halaman pemilih tenant punya error boundary", () => {
    const source = read("src/app/dashboard/tenant/error.tsx");
    expect(source).toContain("Tidak bisa membuka tenant");
    expect(source).toContain("Coba lagi");
  });
});
