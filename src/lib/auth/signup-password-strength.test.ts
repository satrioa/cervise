import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, meetsPasswordLength } from "@/lib/auth/password-policy";

/**
 * Meter password di /signup menampilkan checklist aturan. Kalau aturan
 * "length" di situ tidak memakai konstanta yang sama dengan yang dipakai
 * signupAction, form akan menampilkan syarat yang berbeda dari yang benar-benar
 * ditegakkan - dan yang terburuk, tombol submit bisa aktif untuk password yang
 * ditolak server.
 */

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

function readCode(relativePath: string): string {
  return read(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !(/(?<!:)\/\//.test(line) || line.trimStart().startsWith("//")))
    .join("\n");
}

const signupPage = readCode("src/app/signup/page.tsx");
const signupActions = readCode("src/app/signup/actions.ts");

describe("signup password policy is shared, not duplicated", () => {
  it("the signup form reads the minimum from the shared policy module", () => {
    expect(signupPage).toContain("meetsPasswordLength(password)");
    expect(signupPage).not.toMatch(/password\.length\s*<\s*\d/);
    expect(signupPage).not.toMatch(/password\.length\s*>=\s*\d/);
  });

  it("the server action reads the same minimum instead of hardcoding a number", () => {
    expect(signupActions).toContain("meetsPasswordLength(password)");
    expect(signupActions).not.toMatch(/password\.length\s*<\s*\d/);
  });

  it("both sides import the one policy module", () => {
    expect(signupPage).toMatch(/from "@\/lib\/auth\/password-policy"/);
    expect(signupActions).toMatch(/from "@\/lib\/auth\/password-policy"/);
  });

  it("the length rule shown to the user is built from the same constant", () => {
    expect(signupPage).toContain("test: (v) => meetsPasswordLength(v)");
  });
});

describe("meter rules stay consistent with the gate", () => {
  it("a password that unlocks the button also ticks the length rule", () => {
    const exactlyMinimum = "a".repeat(MIN_PASSWORD_LENGTH);
    expect(meetsPasswordLength(exactlyMinimum)).toBe(true);
  });

  it("a password one character short is blocked and fails the length rule", () => {
    expect(meetsPasswordLength("a".repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
  });
});
