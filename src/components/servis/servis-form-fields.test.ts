import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { teknisiLabel } from "@/lib/servis-technisi-label";

/**
 * Bug yang dilaporkan: select teknisi di form servis menampilkan id teknisi
 * bukan nama.
 *
 * Penyebabnya dua, dan keduanya perlu dijaga terpisah:
 *
 * 1. `Select.Value` milik base-ui menampilkan VALUE MENTAH kalau tidak diberi
 *    children. Tidak seperti Radix yang mencari item terpilih lalu menampilkan
 *    children-nya, base-ui tidak Melacak itu -- jadi trigger menampilkan UUID.
 *    Semua select lain di repo ini sudah mengoper children secara eksplisit;
 *    select teknisi adalah pengecualian yang tidak terlihat sampai dipakai.
 *
 * 2. Daftar item jatuh ke `t.id.slice(0, 6)` kalau nama dan nomor kosong.
 *    Enam karakter UUID yang disamarkan jadi nama orang lebih buruk daripada
 *    mengakui tidak ada nama, karena terlihat seperti data yang benar.
 *
 * Keduanya senyap: tidak ada error, tidak ada build gagal.
 */
describe("teknisiLabel", () => {
  it("memakai nama lengkap kalau ada", () => {
    expect(teknisiLabel({ id: "fc158305-7b47-431a-b4d4-96421f3c2f5c", full_name: "Dodik Teknisi", phone: "6289531467668" }))
      .toBe("Dodik Teknisi");
  });

  it("jatuh ke nomor kalau nama kosong", () => {
    expect(teknisiLabel({ id: "abc12345-1111-2222-3333-444444444444", full_name: null, phone: "6289531467668" }))
      .toBe("6289531467668");
  });

  it("jatuh ke nomor kalau nama hanya spasi", () => {
    // `full_name` dari database bisa berupa whitespace. Tanpa `.trim()`, yang
    // tampil di UI adalah ruang kosong yang terlihat seperti glitch.
    expect(teknisiLabel({ id: "abc12345-1111-2222-3333-444444444444", full_name: "   ", phone: "6289531467668" }))
      .toBe("6289531467668");
  });

  it("TIDAK PERNAH mengembalikan potongan id, walau nama dan nomor kosong", () => {
    const label = teknisiLabel({ id: "fc158305-7b47-431a-b4d4-96421f3c2f5c", full_name: null, phone: null });
    expect(label).toBe("Tanpa nama");
    // Penjaga eksplisit untuk bentuk lama, yang mengembalikan `id.slice(0, 6)`.
    expect(label).not.toContain("fc1583");
    expect(label).not.toMatch(/^[0-9a-f]{6}$/);
  });

  it("teknisi yang tidak ada menghasilkan teks placeholder, bukan string kosong", () => {
    // Trigger select yang kosong tanpa penjelasan terlihat lebih rusak daripada
    // placeholder yang jelas.
    expect(teknisiLabel(undefined)).toBe("Pilih teknisi");
    expect(teknisiLabel(null)).toBe("Pilih teknisi");
    expect(teknisiLabel(undefined)).not.toBe("");
  });
});

describe("select teknisi di form servis", () => {
  const create = readFileSync(join(process.cwd(), "src", "components", "servis", "servis-form.tsx"), "utf8");
  const edit = readFileSync(join(process.cwd(), "src", "components", "servis", "edit-servis-form.tsx"), "utf8");

  for (const [name, source] of [["servis-form", create], ["edit-servis-form", edit]] as const) {
    describe(name, () => {
      it("SelectValue teknisi diberi children, tanpa itu trigger menampilkan UUID", () => {
        const value = source.match(/<SelectValue[^>]*placeholder="Pilih teknisi"[\s\S]{0,200}?<\/SelectValue>/);
        expect(value).not.toBeNull();
        expect(value?.[0]).toContain("teknisiLabel");
      });

      it("tidak ada lagi fallback id.slice pada item teknisi", () => {
        // Bentuk `id.slice(0, 6)` adalah bug yang dilaporkan; jangan sampai
        // kembali lewat "perbaikan" kecil pada label.
        expect(source).not.toMatch(/\.id\.slice\(/);
      });

      it("title kartu teknisi tidak lagi menandai wajib dua kali", () => {
        // `Teknisi *` muncul sebagai CardTitle DAN sebagai Label. Yang Label
        // tetap, karena itu yang menempel ke field.
        expect(source).toContain('<CardTitle className="text-base">Teknisi</CardTitle>');
        expect(source).toContain("<Label>Teknisi *</Label>");
      });

      it("IMEI 1 tidak lagi ditandai wajib", () => {
        expect(source).toContain("<Label>IMEI / SN 1</Label>");
        expect(source).not.toContain("<Label>IMEI / SN 1 *</Label>");
        expect(source).not.toContain("IMEI/SN 1 wajib");
      });

      it("deskripsi 'Perkiraan awal' di kartu estimasi dihapus", () => {
        expect(source).not.toMatch(/Perkiraan awal/);
        // Input-nya sendiri tetap ada: yang diminta hilang teksnya saja.
        expect(source).toContain("Estimasi (Rp)");
      });
    });
  }
});
