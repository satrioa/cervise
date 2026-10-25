import { describe, expect, it } from "vitest";
import { todoSelesaiSebelumHariIni } from "./home-data";

/** 18 Oktober 2026 pukul 08:00 WIB = 01:00 UTC. */
const PAGI_WIB = new Date("2026-10-18T01:00:00.000Z");

describe("todoSelesaiSebelumHariIni", () => {
  it("membersihkan tugas yang dicentang kemarin", () => {
    expect(todoSelesaiSebelumHariIni("2026-10-17T10:00:00.000Z", PAGI_WIB)).toBe(true);
    // 23:59 WIB tanggal 17 = 16:59 UTC. Masih harus dibersihkan.
    expect(todoSelesaiSebelumHariIni("2026-10-17T16:59:00.000Z", PAGI_WIB)).toBe(true);
    // Beberapa hari lalu juga.
    expect(todoSelesaiSebelumHariIni("2026-10-10T03:00:00.000Z", PAGI_WIB)).toBe(true);
  });

  it("mempertahankan tugas yang dicentang hari ini", () => {
    // Tepat tengah malam WIB tanggal 18 = 17:00 UTC tanggal 17.
    expect(todoSelesaiSebelumHariIni("2026-10-17T17:00:00.000Z", PAGI_WIB)).toBe(false);
    // 00:30 dan 23:59 WIB tanggal 18.
    expect(todoSelesaiSebelumHariIni("2026-10-17T17:30:00.000Z", PAGI_WIB)).toBe(false);
    expect(todoSelesaiSebelumHariIni("2026-10-18T16:59:00.000Z", PAGI_WIB)).toBe(false);
  });

  it("tidak menyentuh tugas yang belum selesai", () => {
    expect(todoSelesaiSebelumHariIni(null, PAGI_WIB)).toBe(false);
  });

  it("tidak menghapus baris yang timestamp-nya rusak", () => {
    // `"pending"` dipakai sementara saat toggle optimistik.
    expect(todoSelesaiSebelumHariIni("pending", PAGI_WIB)).toBe(false);
    expect(todoSelesaiSebelumHariIni("bukan tanggal", PAGI_WIB)).toBe(false);
  });
});
