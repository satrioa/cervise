import { describe, expect, it } from "vitest";
import { code128B, code128Svg } from "./code128";

describe("Code 128B", () => {
  it("menghitung checksum standar", () => {
    // Dihitung manual: start B + nilai tiap karakter × posisi, modulo 103.
    expect(code128B("SRV-2026-0001").checksum).toBe(72);
  });

  it("memakai start B, checksum, dan stop", () => {
    const { widths } = code128B("A");
    // Start B (211214) + "A" (nilai 33 → 111422) + checksum + stop (2331112).
    expect(widths.slice(0, 6)).toEqual([2, 1, 1, 2, 1, 4]);
    expect(widths.slice(-7)).toEqual([2, 3, 3, 1, 1, 1, 2]);
  });

  it("membuang karakter non-ASCII dan tetap menghasilkan SVG", () => {
    expect(code128B("SRV·1").checksum).toBe(code128B("SRV1").checksum);
    expect(code128Svg("SRV-1")).toContain("<svg");
  });
});
