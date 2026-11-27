import { describe, expect, it } from "vitest";
import { formatWibStamp } from "./format";

describe("formatWibStamp", () => {
  it("memakai WIB dengan format dd/MM/yyyy | HH:mm", () => {
    expect(formatWibStamp("2026-11-27T07:32:00.000Z")).toBe("27/11/2026 | 14:32");
  });

  it("menampilkan — untuk nilai kosong atau tidak valid", () => {
    expect(formatWibStamp(null)).toBe("—");
    expect(formatWibStamp("bukan tanggal")).toBe("—");
  });
});
