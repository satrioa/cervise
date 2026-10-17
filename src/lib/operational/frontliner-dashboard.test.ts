import { describe, expect, it } from "vitest";
import { buildFrontlinerKpi } from "./frontliner-dashboard";

const HARI_INI = [
  { status: "Masuk" },
  { status: "Masuk" },
  { status: "Masuk" },
  { status: "Masuk" },
  { status: "Masuk" },
  { status: "Selesai" },
  { status: "Selesai" },
  { status: "Sudah Diambil" },
  { status: "Sudah Diambil" },
  { status: "Sudah Diambil" },
  { status: "Sudah Diambil" },
  { status: "Sudah Diambil" },
  { status: "Sudah Diambil" },
  { status: "Sudah Diambil" },
  { status: "Sudah Diambil" },
  { status: "Batal" },
];

describe("buildFrontlinerKpi", () => {
  it("menghitung empat angka untuk strip Ringkasan Servis", () => {
    // Kartu di Figma menampilkan "5 Masuk / 2 Selesai / 8 Diambil".
    expect(buildFrontlinerKpi(HARI_INI)).toEqual({
      masuk: 5,
      selesai: 2,
      diambil: 8,
      proses: 5,
    });
  });

  it("Selesai dan Sudah Diambil dihitung terpisah", () => {
    // `diambil` hanya "Sudah Diambil"; `selesai` hanya "Selesai". Kalau
    // keduanya memakai himpunan yang sama, keduanya akan bernilai sama dan
    // kartu jadi tidak informatif.
    const kpi = buildFrontlinerKpi([{ status: "Selesai" }, { status: "Sudah Diambil" }]);
    expect(kpi.selesai).toBe(1);
    expect(kpi.diambil).toBe(1);
  });

  it("Batal tidak masuk ke angka mana pun", () => {
    const kpi = buildFrontlinerKpi([{ status: "Batal" }, { status: "Batal" }]);
    expect(kpi).toEqual({ masuk: 0, selesai: 0, diambil: 0, proses: 0 });
  });

  it("daftar kosong menghasilkan nol semua, bukan NaN", () => {
    expect(buildFrontlinerKpi([])).toEqual({ masuk: 0, selesai: 0, diambil: 0, proses: 0 });
  });
});
