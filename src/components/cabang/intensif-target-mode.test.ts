import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Field "Target per teknisi per bulan" hanya berlaku di mode flat.
 *
 * Alasannya: target adalah syarat pembayaran mode flat. Mode percent dan fixed
 * dibayar tanpa target, jadi menampoilkannya di sana tidak cuma membingungkan
 * -- sisa target dari data lama akan diam-diam menggerakkan KPI "Target" dan
 * progress bar untuk cabang yang sistemnya memang tidak memakai gate target.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

const readCode = (p: string) => stripComments(read(p));

const drawer = readCode("src/components/cabang/cabang-drawer.tsx");
const actions = readCode("src/app/app/cabang/actions.ts");
const cards = readCode("src/components/cabang/branch-cards.tsx");
const kpi = readCode("src/lib/operational/technician-dashboard.ts");
const dashboard = readCode("src/components/dashboard/technician-dashboard.tsx");
const performa = readCode("src/lib/operational/performa-teknisi.ts");

describe("target hanya berlaku di mode flat", () => {
  it("drawer hanya merender field target saat mode flat", () => {
    expect(drawer).toMatch(/TARGET_MODES/);
    expect(drawer).toMatch(/TARGET_MODES\.has\(intensifMode\) &&/);
    // "Opsional ... hanya untuk progress" adalah alasan yang sudah tidak valid.
    expect(drawer).not.toMatch(/hanya dipakai untuk melihat progress/);
  });

  it("pindah mode keluar dari flat membersihkan target", () => {
    // Kalau tidak, nilai lama ikut terkirim dan tersimpan di cabang yang
    // tidak memakainya.
    expect(drawer).toMatch(/if \(!TARGET_MODES\.has\(next\)\) setIntensifTarget\(""\)/);
  });

  it("drawer tidak mengirim target untuk mode selain flat", () => {
    expect(drawer).toMatch(/const target = TARGET_MODES\.has\(intensifMode\) \? rawTarget : null/);
  });

  it("server memaksa target null di mode selain flat", () => {
    // Bukan hanya disembunyikan di form. Kalau tidak, request basi atau yang
    // sengaja dibuat akan meninggalkan target yang tidak berlaku.
    expect(actions).toMatch(/const targetCount = data\.mode === "flat" \? data\.targetCount : null/);
    expect(actions).toMatch(/intensif_target_count: targetCount/);
  });

  it("server tetap mewajibkan target di mode flat", () => {
    expect(actions).toMatch(/data\.mode === "flat" && data\.targetCount === null/);
  });

  it("KPI teknisi menandai target tidak berlaku di mode selain flat", () => {
    expect(kpi).toMatch(/applicable/);
    expect(kpi).toMatch(/const applicable = branchIntensif\?\.intensif_mode === "flat"/);
    expect(kpi).toMatch(/active && applicable && rawTarget/);
  });

  it("performa teknisi mengabaikan sisa target di mode selain flat", () => {
    // Kalau hanya KPI yang sadar mode, laporan masih menampilkan progress
    // sementara dashboard bilang tidak berlaku.
    expect(performa).toMatch(/const hasTarget = mode === "flat" && target !== null && target > 0/);
    expect(performa).toMatch(/intensifTarget: hasTarget \? target : null/);
  });

  it("kartu Target tidak menawarkan tautan yang tidak bisa dipakai teknisi", () => {
    // Link lama menuju `/app/analatik-servis` -- halaman yang salah; target
    // diatur di `/app/cabang`, yang `roles: MANAGERS` jadi tidak bisa dibuka
    // teknisi. Jadi "Atur sekarang" tidak pernah jadi jalan keluar.
    expect(dashboard).not.toMatch(/Atur sekarang/);
    expect(dashboard).not.toMatch(/href="\/app\/analitik-servis"/);
    expect(dashboard).toMatch(/!kpi\.applicable/);
  });
});

describe("mode insentif: tiga label, tidak ada union yang bisa ketinggalan", () => {
  it("branch-cards mengakui mode flat", () => {
    // Union lama hanya punya percent|fixed, ditutup dengan cast, jadi
    // bonus flat dirender seolah nominal per servis.
    expect(cards).toMatch(/intensif_mode: "percent" \| "fixed" \| "flat"/);
  });

  it("branch-cards melabeli ketiga mode secara berbeda", () => {
    expect(cards).toMatch(/if \(b\.intensif_mode === "percent"\)/);
    expect(cards).toMatch(/if \(b\.intensif_mode === "flat"\)/);
    expect(cards).toMatch(/per servis/);
    expect(cards).toMatch(/bila ≥/);
  });

  it("actions.ts memvalidasi mode, bukan menc-cast-nya", () => {
    // Cast `as "percent" | "fixed"` menyembunyikan "flat" dari compiler.
    expect(actions).not.toMatch(/as "percent" \| "fixed"/);
    expect(actions).toMatch(/function readIntensifMode/);
  });
});
