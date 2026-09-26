import { describe, expect, it } from "vitest";
import {
  GENERATED_PASSWORD_LENGTH,
  PASSWORD_ALPHABET,
  generateTempPassword,
} from "./password";

describe("generateTempPassword", () => {
  it("returns the requested length, including the forced suffix", () => {
    expect(generateTempPassword().length).toBe(GENERATED_PASSWORD_LENGTH);
    expect(generateTempPassword(20)).toHaveLength(20);
    expect(generateTempPassword(8)).toHaveLength(8);
  });

  it("always ends with a digit and a symbol so it passes common password rules", () => {
    for (let i = 0; i < 200; i += 1) {
      const password = generateTempPassword();
      expect(password.slice(-2)).toBe("1!");
      expect(password).toMatch(/[A-Za-z]/);
      expect(password).toMatch(/\d/);
    }
  });

  it("only uses characters from the alphabet, never ambiguous ones", () => {
    for (let i = 0; i < 200; i += 1) {
      const body = generateTempPassword().slice(0, -2);
      for (const char of body) {
        expect(PASSWORD_ALPHABET).toContain(char);
        // I, l, O, 0 and 1 are excluded to survive being read aloud or retyped.
        expect("IlO01").not.toContain(char);
      }
    }
  });

  it("never repeats the same password twice", () => {
    const seen = new Set(Array.from({ length: 1000 }, () => generateTempPassword()));
    expect(seen.size).toBe(1000);
  });

  it("spreads every character of the alphabet, not just the first few", () => {
    const counts = new Map<string, number>();
    const samples = 20000;
    for (let i = 0; i < samples; i += 1) {
      for (const char of generateTempPassword().slice(0, -2)) {
        counts.set(char, (counts.get(char) ?? 0) + 1);
      }
    }

    // Tidak ada karakter yang boleh hilang diam-diam.
    expect(counts.size).toBe(PASSWORD_ALPHABET.length);
  });

  it("has no modulo bias toward the start of the alphabet", () => {
    // Bug yang diuji: `byte % 58` memberi 24 huruf pertama 5 slot dan 34 huruf
    // sisanya 4 slot per 256 byte, jadi huruf pertama muncul ~1,25x lebih
    // sering. Di sini yang dibandingkan adalah rata-rata kedua kelompok itu,
    // langsung terhadap rasio yang caused bug - bukan toleransi longgar yang
    // tidak akan menangkap apa pun.
    const boundary = 24;
    const samples = 30000;

    let head = 0;
    let tail = 0;
    for (let i = 0; i < samples; i += 1) {
      const body = generateTempPassword().slice(0, -2);
      for (let c = 0; c < body.length; c += 1) {
        const index = PASSWORD_ALPHABET.indexOf(body[c]);
        if (index < boundary) head += 1;
        else tail += 1;
      }
    }

    const expectedRatio = boundary / (PASSWORD_ALPHABET.length - boundary);
    const actualRatio = head / tail;

    expect(head).toBeGreaterThan(0);
    expect(tail).toBeGreaterThan(0);
    // Sebanding ideal: rasio huruf pertama : huruf terakhir = 24 : 34.
    expect(actualRatio).toBeGreaterThan(expectedRatio * 0.9);
    expect(actualRatio).toBeLessThan(expectedRatio * 1.1);
    // Dan versi biased akan jatuh di sini, jadi guard ini tidak bisa lolos.
    expect(actualRatio).toBeLessThan(1.15);
  });

  it("clamps a length that would leave no room for the suffix", () => {
    expect(generateTempPassword(1).length).toBeGreaterThanOrEqual(1);
    expect(generateTempPassword(0).length).toBeGreaterThanOrEqual(1);
  });
});
