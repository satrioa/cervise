import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Alur "Check Kondisi Awal" yang dilaporkan: formnya muncul sebagai modal di atas
 * form servis, dan tombol simpannya tidak pernah terlihat.
 *
 * Tombolnya sebenarnya ADA -- di `kondisi-awal-dialog` yang lama, di kaki popup.
 * Yang terjadi adalah popup-nya `grid` dengan `max-h-[85vh]` + `overflow-hidden`,
 * sementara badan yang dimaksudkan bisa digulir memakai `flex-1`. Di dalam
 * `grid`, `flex-1` tidak berlaku, jadi badan tumbuh setinggi isinya; sebelas item
 * membuat isinya melewati batas tinggi, dan `overflow-hidden` memotong kaki
 * dialog. Tombolnya ada tapi di luar layar.
 *
 * Jadi yang dijaga di sini bukan "tombolnya ada" -- itu sudah ada sebelumnya dan
 * tetap tidak terlihat. Yang dijaga adalah tidak kembalinya ke pola `grid` +
 * `flex-1` di dalam container dengan tinggi maksimum, karena itu pola yang
 * menyembunyikan tombol.
 */
describe("form kondisi awal (inline, bukan modal)", () => {
  const form = readFileSync(
    join(process.cwd(), "src", "components", "servis", "kondisi-awal-form.tsx"),
    "utf8",
  );
  const parent = readFileSync(
    join(process.cwd(), "src", "components", "servis", "servis-form.tsx"),
    "utf8",
  );

  it("memang punya tombol simpan yang bisa diklik", () => {
    // Guard langsung untuk gejala yang dilaporkan.
    expect(form).toContain("Simpan Kondisi");
    expect(form).toMatch(/onClick=\{handleSave\}/);
  });

  it("tidak lagi memakai primitive Dialog sama sekali", () => {
    expect(form).not.toContain("DialogPrimitive");
    expect(form).not.toContain("Dialog as DialogPrimitive");
  });

  it("tidak memakai kombinasi max-h + overflow-hidden yang menyembunyikan kaki", () => {
    // Polanya bukan "grid" -- grid untuk baris item itu benar dan sengaja.
    // Yang merusak adalah `max-h` + `overflow-hidden` pada satu container: anak
    // yang hoped bisa digulir tidak pernah jadi container scroll, jadi isinya
    // dipotong dan apa pun di bawahnya hilang.
    //
    // Kalau versi ini nanti butuh tinggi maksimum, polanya `flex flex-col`
    // dengan anak `flex-1 overflow-auto`, bukan memotong.
    const capped = form.match(/className="[^"]*max-h-\[[^\]]*\][^"]*"/g) ?? [];
    for (const cls of capped) {
      expect(cls).not.toContain("overflow-hidden");
    }
  });

  it("tombol normal/tidak-normal pakai aria-pressed supaya statusnya terbaca", () => {
    // Tanpa itu, tombol yang sedang aktif hanya dibedakan dari warna, dan
    // pembaca layar tidak tahu item mana yang sudah ditandai.
    expect(form).toContain("aria-pressed");
  });

  it("input catatan punya aria-label, tidak hanya placeholder", () => {
    // Placeholder hilang begitu ada ketikan, jadi screen reader kehilangan
    // penjelasan field mana yang sedang diisi.
    expect(form).toContain("aria-label={`Catatan");
  });

  it("form kondisi menggantikan tampilan form servis, bukan menumpuk di atasnya", () => {
    // Ternary, bukan dialog di atas form.
    expect(parent).toMatch(/kondisiOpen && savedId\s*\?\s*\(\s*<KondisiAwalForm/);
    expect(parent).not.toContain("KondisiAwalDialog");
  });

  it("kondisi diinisialisasi untuk semua item, jadi tidak ada entri undefined", () => {
    expect(form).toMatch(/KONDISI_ITEMS\.forEach/);
  });
});

describe("switch dan tombol check kondisi", () => {
  const parent = readFileSync(
    join(process.cwd(), "src", "components", "servis", "servis-form.tsx"),
    "utf8",
  );

  it("switch Kondisi ada dan gerbang menampilkan tombolnya", () => {
    // Mematikan switch harus menyembunyikan tombol, bukan hanya menonaktifkannya --
    // tombol yang terlihat tapi tidak bisa dipakai lebih buruk dari yang
    // tidak terlihat.
    expect(parent).toMatch(/\{kondisiEnabled \?/);
    expect(parent).toContain("kondisiEnabled");
  });

  it("tombolnya berlabel Check Kondisi dengan chevron di sisi kanan", () => {
    expect(parent).toContain("Check Kondisi");
    const button = parent.match(/<Button[\s\S]{0,600}?Check Kondisi[\s\S]{0,400}?<\/Button>/);
    expect(button).not.toBeNull();
    // `justify-between` + chevron setelah span = chevron di tepi kanan.
    expect(button?.[0]).toContain("justify-between");
    expect(button?.[0]).toContain("ChevronRight");
  });

  it("chevron berputar saat formnya terbuka", () => {
    expect(parent).toMatch(/kondisiOpen\s*&&\s*"rotate-90"/);
  });

  it("memakai aria-expanded supaya keadaan tombol terbaca assistive tech", () => {
    expect(parent).toContain("aria-expanded={kondisiOpen}");
  });

  it("klik Check Kondisi menyimpan servis dulu sebelum membuka form", () => {
    // `updateKondisiAwal` butuh id servis, dan id itu hanya ada setelah create.
    // Kalau urutan dibalik, formnya terbuka untuk data yang belum bisa disimpan.
    const handler = parent.match(/const handleKondisiClick[\s\S]{0,700}?\n  \};/);
    expect(handler).not.toBeNull();
    const body = handler?.[0] ?? "";
    expect(body).toContain("saveServis()");
    expect(body.indexOf("saveServis()")).toBeLessThan(body.indexOf("setKondisiOpen(true)"));
    expect(body).toContain("setSavedId(res.id)");
  });

  it("mematikan switch ikut menutup form yang terbuka", () => {
    // Kalau tidak, isi yang sudah diketik menggantung di layar tanpa jalan
    // menutupnya -- dan user tidak tahu datanya masih di state.
    expect(parent).toMatch(/if \(!v\) setKondisiOpen\(false\)/);
  });
});
