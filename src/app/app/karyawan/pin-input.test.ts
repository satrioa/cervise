import { describe, expect, it } from "vitest";
import { normalizePinInput } from "./pin-input";
import { validPin } from "@/lib/attendance/pin";

describe("PIN input karyawan", () => {
  it("membuang karakter bukan digit dan membatasi 6 digit", () => {
    expect(normalizePinInput("12a3456")).toBe("123456");
    expect(normalizePinInput(" 12345 ")).toBe("12345");
    expect(normalizePinInput("1234567")).toBe("123456");
    expect(normalizePinInput("")).toBe("");
  });
  it("hanya PIN 6 digit yang diterima", () => {
    expect(validPin(normalizePinInput("123456"))).toBe(true);
    expect(validPin(normalizePinInput("abc123"))).toBe(false);
    expect(validPin(normalizePinInput(""))).toBe(false);
  });
});
