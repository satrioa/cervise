import { describe, expect, it } from "vitest";
import {
  awalHariWIB,
  dalamRentangBulan,
  dalamHariYangSama,
  kalenderWIB,
  rentangBulanSekarang,
} from "./periode-bulan";

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

/** 18 Oktober 2026 pukul 00:30 WIB = 17 Oktober 17:30 UTC. */
const SETENGAH_MALAM_WIB = new Date("2026-10-17T17:30:00.000Z");
/** 18 Oktober 2026 pukul 08:00 WIB. */
const PAGI_WIB = new Date("2026-10-18T01:00:00.000Z");

describe("kalenderWIB", () => {
  // Bug yang diuji: toISOString().slice(0, 10) mengembalikan hari UTC. WIB 7
  // jam di depan, jadi transaksi jam 00:00-07:00 waktu lokal jatuh di hari
  // sebelumnya: salah hari di Laporan Penjualan, salah kas_date di Arus Kas,
  // dan keluar dari shift yang sebenarnya sedang buka.
  it("tidak menggeser transaksi tengah malam ke hari sebelumnya", () => {
    expect(kalenderWIB(SETENGAH_MALAM_WIB)).toBe("2026-10-18");
  });

  it("tidak menggeser transaksi pagi ke tanggal sebelumnya", () => {
    expect(kalenderWIB(PAGI_WIB)).toBe("2026-10-18");
  });

  it("batasnya tepat di tengah malam WIB", () => {
    expect(kalenderWIB(new Date("2026-10-17T16:59:00.000Z"))).toBe("2026-10-17");
    expect(kalenderWIB(new Date("2026-10-17T17:00:00.000Z"))).toBe("2026-10-18");
  });

  it("meng Nolkan hari dan bulan di bawah 10", () => {
    expect(kalenderWIB(wibKeUtc(2026, 0, 4, 11))).toBe("2026-01-04");
    expect(kalenderWIB(wibKeUtc(2026, 1, 9, 11))).toBe("2026-02-09");
  });

  it("mengubah tahun saat Desember berakhir", () => {
    expect(kalenderWIB(wibKeUtc(2026, 0, 1, 1))).toBe("2026-01-01");
    expect(kalenderWIB(wibKeUtc(2025, 11, 31, 23))).toBe("2025-12-31");
  });
});

describe("awalHariWIB", () => {
  // Bug yang diuji: `${kalenderWIB(now)}T00:00:00.000Z` berarti 07:00 WIB, jadi
  // tujuh jam pertama hari lokal justru tidak masuk KPI frontliner.
  it("mengembalikan tengah malam WIB, bukan tengah malam UTC", () => {
    expect(awalHariWIB(PAGI_WIB).toISOString()).toBe("2026-10-17T17:00:00.000Z");
  });

  it("tanggalnya sama dengan kalenderWIB untuk tanggal itu", () => {
    expect(kalenderWIB(awalHariWIB(PAGI_WIB))).toBe(kalenderWIB(PAGI_WIB));
  });

  it("memuat transaksi pukul 00:30 WIB", () => {
    expect(SETENGAH_MALAM_WIB.getTime()).toBeGreaterThan(awalHariWIB(SETENGAH_MALAM_WIB).getTime());
  });

  it("tidak memuat satu milidetik sebelumnya", () => {
    const awal = awalHariWIB(SETENGAH_MALAM_WIB);
    expect(awal.getTime() - 1).toBeLessThan(SETENGAH_MALAM_WIB.getTime());
  });
});