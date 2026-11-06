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

describe("radio check kondisi", () => {
  const parent = readFileSync(
    join(process.cwd(), "src", "components", "servis", "servis-form.tsx"),
    "utf8",
  );

  it("memakai radio Ya/Tidak, bukan switch lama", () => {
    expect(parent).toContain("JellyRadio");
    expect(parent).toContain('{ value: "ya", label: "Ya" }');
    expect(parent).toContain('{ value: "tidak", label: "Tidak" }');
    expect(parent).not.toContain("kondisiEnabled");
  });

  it("default-nya Ya supaya alur pemeriksaan tidak terlewat", () => {
    expect(parent).toMatch(/useState\(true\)/);
    expect(parent).toMatch(/value=\{kondisiYa \? "ya" : "tidak"\}/);
  });

  it("Ya membuka form kondisi setelah servis tersimpan", () => {
    const submit = parent.match(/const handleSubmit[\s\S]{0,900}?\n  \};/)?.[0] ?? "";
    expect(submit).toContain("saveServis()");
    expect(submit).toContain("setSavedId(res.id)");
    expect(submit).toMatch(/if \(kondisiYa\) setKondisiOpen\(true\)/);
    expect(submit.indexOf("saveServis()")).toBeLessThan(submit.indexOf("setKondisiOpen(true)"));
  });

  it("Tidak langsung menyelesaikan servis tanpa membuka form", () => {
    const submit = parent.match(/const handleSubmit[\s\S]{0,900}?\n  \};/)?.[0] ?? "";
    expect(submit).toContain("else finish()");
    // Servis yang sudah tersimpan tidak boleh dibuat dua kali.
    expect(submit).toMatch(/if \(savedId\) \{\s*finish\(\)/);
  });
});
