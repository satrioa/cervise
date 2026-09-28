import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, meetsPasswordLength } from "@/lib/auth/password-policy";

describe("password policy", () => {
  it("requires 8 characters, matching what Supabase accepts", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it("rejects anything shorter than the minimum", () => {
    expect(meetsPasswordLength("")).toBe(false);
    expect(meetsPasswordLength("a".repeat(7))).toBe(false);
  });

  it("accepts exactly the minimum length", () => {
    expect(meetsPasswordLength("a".repeat(8))).toBe(true);
  });

  it("accepts longer passwords", () => {
    expect(meetsPasswordLength("a".repeat(40))).toBe(true);
  });

  it("does not trim before measuring, so a space cannot pad the count", () => {
    // "1234567 " is 8 characters but only 7 real ones. Server-side this is the
    // raw input, so the client-side gate must measure it the same way rather
    // than being stricter (or looser) than the server.
    expect(meetsPasswordLength("1234567 ")).toBe(true);
  });
});
