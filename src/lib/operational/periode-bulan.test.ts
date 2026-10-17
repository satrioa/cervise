import { describe, expect, it } from "vitest";
import { dalamRentangBulan, dalamHariYangSama, rentangBulanSekarang } from "./periode-bulan";

const UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

function wibKeUtc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) + second * 1000 - UTC_OFFSET_MS);
}

describe("rentangBulanSekarang", () => {
  it("membuat rentang setengah terbuka yang dimulai pukul 00:00 WIB tanggal 1", () => {
    const { from, to } = rentangBulanSekarang(wibKeUtc(2026, 8, 23, 10));

    expect(from.toISOString()).toBe(wibKeUtc(2026, 8, 1).toISOString());
    expect(to.toISOString()).toBe(wibKeUtc(2026, 9, 1).toISOString());
  });

  it("mengtreat tanggal 1 pukul 00:01 WIB sebagai bulan baru, bukan bulan sebelumnya", () => {
    const now = wibKeUtc(2026, 9, 1, 0, 1);

    const { from, to } = rentangBulanSekarang(now);

    expect(from.toISOString()).toBe(wibKeUtc(2026, 9, 1).toISOString());
    expect(to.toISOString()).toBe(wibKeUtc(2026, 10, 1).toISOString());
  });

  it("menggunakan waktu lokal cabang, bukan UTC, untuk menentukan bulan", () => {
    const { from } = rentangBulanSekarang(new Date("2026-09-30T20:00:00Z"));

    expect(from.toISOString()).toBe(wibKeUtc(2026, 9, 1).toISOString());
  });

  it("membungkus pergantian tahun dengan benar", () => {
    const { from, to } = rentangBulanSekarang(wibKeUtc(2026, 11, 20));

    expect(from.toISOString()).toBe(wibKeUtc(2026, 11, 1).toISOString());
    expect(to.toISOString()).toBe(wibKeUtc(2027, 0, 1).toISOString());
  });
});

describe("dalamRentangBulan", () => {
  it("memasukkan awal bulan dan menolak awal bulan berikutnya", () => {
    const now = wibKeUtc(2026, 8, 23, 10);

    expect(dalamRentangBulan(wibKeUtc(2026, 8, 1).toISOString(), now)).toBe(true);
    expect(dalamRentangBulan(wibKeUtc(2026, 9, 1).toISOString(), now)).toBe(false);
  });

  it("memasukkan detik terakhir bulan berjalan", () => {
    const now = wibKeUtc(2026, 8, 23, 10);
    const akhir = wibKeUtc(2026, 8, 30, 23, 59, 59);

    expect(dalamRentangBulan(akhir.toISOString(), now)).toBe(true);
  });

  it("menolak tanggal yang tidak bisa diparsing", () => {
    expect(dalamRentangBulan("bukan tanggal", wibKeUtc(2026, 8, 23))).toBe(false);
  });

  it("menolak nilai kosong", () => {
    expect(dalamRentangBulan(null, wibKeUtc(2026, 8, 23))).toBe(false);
    expect(dalamRentangBulan(undefined, wibKeUtc(2026, 8, 23))).toBe(false);
  });
});

describe("dalamHariYangSama", () => {
  it("menghitung hari menurut waktu Indonesia, bukan UTC", () => {
    // 2026-09-30T19:00Z = 1 Oktober 00:00 WIB. Kalau dihitung pakai UTC,
    // ini masih dianggap 30 September.
    const now = new Date("2026-09-30T18:00:00Z");
    expect(dalamHariYangSama("2026-09-30T19:00:00Z", now)).toBe(true);
  });

  it("memasukkan awal hari lokal dan menolak satu milidetik sebelumnya", () => {
    const now = wibKeUtc(2026, 8, 23, 10);
    expect(dalamHariYangSama(wibKeUtc(2026, 8, 23).toISOString(), now)).toBe(true);
    expect(dalamHariYangSama(new Date(wibKeUtc(2026, 8, 23).getTime() - 1).toISOString(), now)).toBe(false);
  });

  it("menolak tanggal lain dan tanggal rusak", () => {
    const now = wibKeUtc(2026, 8, 23, 10);
    expect(dalamHariYangSama(wibKeUtc(2026, 8, 24).toISOString(), now)).toBe(false);
    expect(dalamHariYangSama("bukan-tanggal", now)).toBe(false);
    expect(dalamHariYangSama(null, now)).toBe(false);
    expect(dalamHariYangSama(undefined, now)).toBe(false);
  });
});
