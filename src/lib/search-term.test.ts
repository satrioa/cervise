import { describe, expect, it } from "vitest";
import { sanitizeSearchTerm } from "./search-term";

describe("sanitizeSearchTerm", () => {
  it("membuang karakter yang bisa mengubah filter PostgREST", () => {
    expect(sanitizeSearchTerm("a,b")).toBe("ab");
    expect(sanitizeSearchTerm("x)y")).toBe("xy");
    expect(sanitizeSearchTerm("100%")).toBe("100");
    expect(sanitizeSearchTerm("a*b")).toBe("ab");
    expect(sanitizeSearchTerm("a\\b")).toBe("ab");
  });

  it("memangkas input panjang", () => {
    expect(sanitizeSearchTerm("a".repeat(200))).toHaveLength(60);
  });

  it("tidak mengubah teks biasa", () => {
    expect(sanitizeSearchTerm("  Redmi Note 13  ")).toBe("Redmi Note 13");
  });
});