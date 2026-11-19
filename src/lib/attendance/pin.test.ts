import { describe, expect, it } from "vitest";
import { validPin } from "./pin";

describe("validPin", () => {
  it("hanya menerima enam digit", () => {
    expect(validPin("123456")).toBe(true);
    expect(validPin("12345")).toBe(false);
    expect(validPin("1234567")).toBe(false);
    expect(validPin("12a456")).toBe(false);
    expect(validPin(" 123456 ")).toBe(false);
  });
});
