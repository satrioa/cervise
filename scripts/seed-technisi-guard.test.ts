import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Seed tidak boleh mencatat admin sebagai teknisi.
 *
 * Bugnya terlihat wajar: esolveTarget() mengambil employee PERTAMA di
 * tenant dengan `.limit(1).single()` lalu memakai `profile_id`-nya untuk
 * `created_by` sekaligus `teknisi_id`. Kalau yang pertama itu admin -- dan
 * itulah yang terjadi -- seluruh servis demo tercatat dikerjakan oleh admin.
 *
 * Akibatnya tidak terlihat sama sekali: seed sukses, tidak ada error, tidak
 * ada konsol merah. Yang muncul jauh kemudian adalah dashboard teknisi kosong
 * untuk semua orang, dan -- sejak notifikasi WhatsApp ada -- pesan yang dikirim
 * ke nomor admin.
 *
 * Jadi yang dijaga di sini bukan hanya "technisi_id bukan actorProfileId", tapi
 * juga bahwa teknisi dicari dengan filter role dan cabang yang benar.
 */
const source = readFileSync(
  join(process.cwd(), "scripts", "seed-demo-data.mjs"),
  "utf8",
);

describe("seed: teknisi demo bukan admin", () => {
  it("teknisi_id tidak pernah diisi dengan actorProfileId", () => {
    expect(source).not.toMatch(/teknisi_id:\s*[^,\n]*actorProfileId/);
    expect(source).toMatch(/teknisi_id:\s*resolveTeknisiId\(/);
  });

  it("aktor dan teknisi diambil lewat pemanggilan yang terpisah", () => {
    // Kalau keduanya datang dari satu query, tidak ada cara membedakan siapa
    // teknisi dari siapa penandatangan.
    const target = source.match(/async function resolveTarget\(\)[\s\S]*?\n\}/)?.[0] ?? "";
    expect(target).toContain("actorProfileId");
    expect(target).toContain("technicians");
  });

  it("query teknisi memfilter role TECHNICIAN, aktif, dan cabang yang sama", () => {
    // Dipotong ke blok query teknisi saja. `is_active` dan `organization_id`
    // juga muncul di query branches dan employees di atasnya, jadi kalau
    // assertion-nya dipukul ke seluruh `resolveTarget`, filter yang diuji
    // bisa jadi milik query lain dan test tetap hijau.
    const techniciansQuery =
      source.match(/from\("employees"\)[\s\S]{0,400}?role",\s*"TECHNICIAN"[\s\S]{0,300}?\)\s*;/) ?.[0] ?? "";
    expect(techniciansQuery).not.toBe("");
    expect(techniciansQuery).toMatch(/\.eq\("role",\s*"TECHNICIAN"\)/);
    // Cabang wajib karena dashboard teknisi memfilter servis per `branch_id`:
    // teknisi dari cabang lain tidak akan pernah melihat servisnya.
    expect(techniciansQuery).toMatch(/\.eq\("branch_id",\s*branch\.id\)/);
    expect(techniciansQuery).toMatch(/\.eq\("is_active",\s*true\)/);
    expect(techniciansQuery).toMatch(/\.eq\("organization_id",\s*org\.id\)/);
  });

  it("berhenti dengan jelas kalau tenant tidak punya teknisi", () => {
    // Alternatifnya kembali ke admin, dan itu persis bug yang diperbaiki.
    const fn = source.match(/function resolveTeknisiId\([\s\S]*?\n\}/)?.[0] ?? "";
    expect(fn).toContain("throw new Error");
    expect(fn).toContain("technicians.length === 0");
    expect(fn).toMatch(/return null/);
  });

  it("indeks teknisi 0..5 dipetakan dengan modulo, tidak pernah jadi yatim", () => {
    // Data demo memakai indeks sampai 5. Kalau teknisi hanya satu, indeks 5
    // harus tetap menunjuk teknisi itu, bukan null.
    const fn = source.match(/function resolveTeknisiId\([\s\S]*?\n\}/)?.[0] ?? "";
    expect(fn).toContain("technicians[s.teknisi % technicians.length]");
  });

  it("baris demo tanpa teknisi tetap null", () => {
    const fn = source.match(/function resolveTeknisiId\([\s\S]*?\n\}/)?.[0] ?? "";
    expect(fn).toMatch(/s\.teknisi === null \|\| s\.teknisi === undefined/);
  });

  it("created_by tetap memakai aktor seed", () => {
    // Yang berubah hanya teknisi. `created_by` memang harus tetap profil
    // orang yang menjalankan seed.
    expect(source).toMatch(/created_by:\s*actorProfileId/);
  });

  it("ringkasan seed membedakan aktorseeded dari teknisi", () => {
    // Tanpa ini, output seed terlihat sama seperti sebelumnya dan tidak ada
    // yang memberi tahu bahwa teknisi berubah.
    expect(source).toContain("Teknisi  :");
  });
});
