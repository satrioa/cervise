import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Nota servis dicetak otomatis setelah servis tersimpan. Nomor servis baru ada
 * setelah baris dibuat, jadi detail diambil ulang dan printer dipanggil lewat
 * jalur yang sama dengan tombol cetak manual di halaman servis.
 */
describe("cetak nota otomatis setelah servis dibuat", () => {
  const form = readFileSync(
    join(process.cwd(), "src", "components", "servis", "servis-form.tsx"),
    "utf8",
  );

  it("mencetak setelah create berhasil, bukan sebelumnya", () => {
    const create = form.indexOf("await createServis(");
    const print = form.indexOf("printNota(res.id)");
    expect(create).toBeGreaterThan(-1);
    expect(print).toBeGreaterThan(create);
  });

  it("memakai nota servis yang sama dengan halaman servis", () => {
    expect(form).toContain('kind: "service"');
    expect(form).toContain("renderThermalHtml");
    expect(form).toContain("publicTrackingUrl");
  });

  it("kegagalan cetak tidak menggagalkan servis yang sudah tersimpan", () => {
    expect(form).toMatch(/catch \(error\)[\s\S]{0,160}Gagal mencetak nota servis/);
  });
});
