import { describe, expect, it } from "vitest";
import { checkProjectRef } from "./env-check";

const URL = "https://yvekuahqzeqxggdyjecc.supabase.co";

/** JWT payload ref yvekuahqzeqxggdyjecc, dibuat dengan base64url tanpa padding. */
function legacyKey(ref: string): string {
  const payload = Buffer.from(JSON.stringify({ ref, role: "service_role" }))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;
}

describe("checkProjectRef", () => {
  it("confirms a legacy key that belongs to the project", () => {
    const result = checkProjectRef(URL, legacyKey("yvekuahqzeqxggdyjecc"));
    expect(result.urlRef).toBe("yvekuahqzeqxggdyjecc");
    expect(result.keyRef).toBe("yvekuahqzeqxggdyjecc");
    expect(result.matches).toBe(true);
  });

  it("reports a mismatch so the caller can fail loudly", () => {
    const result = checkProjectRef(URL, legacyKey("project-lain"));
    expect(result.matches).toBe(false);
    expect(result.keyRef).toBe("project-lain");
  });

  // Format baru tidak memuat project ref sama sekali. Versi lama memakai
  // key.split(".")[1] yang jadi undefined, error tertelan catch kosong, lalu
  // pemeriksaannya dilewati tanpa jejak - jadi tidak ada yang tahu kalau
  // kredensialnya salah project.
  it("returns 'unknown' rather than 'match' for the new sb_secret_ format", () => {
    const result = checkProjectRef(URL, "sb_secret_abc123_def456");
    expect(result.keyRef).toBeNull();
    expect(result.matches).toBe(false);
  });

  it("returns 'unknown' for a publishable key too", () => {
    const result = checkProjectRef(URL, "sb_publishable_abc123_def456");
    expect(result.keyRef).toBeNull();
    expect(result.matches).toBe(false);
  });

  it("does not throw on a JWT-shaped value with an unreadable payload", () => {
    const result = checkProjectRef(URL, "aaa.!!!not-base64!!!.ccc");
    expect(result.keyRef).toBeNull();
    expect(result.matches).toBe(false);
  });

  it("does not throw on a missing key or a malformed url", () => {
    expect(checkProjectRef(URL, undefined).matches).toBe(false);
    expect(checkProjectRef(URL, "").matches).toBe(false);
    expect(checkProjectRef("bukan-url", legacyKey("x")).urlRef).toBeNull();
  });

  it("treats a JWT without a ref field as unknown, not as a match", () => {
    const payload = Buffer.from(JSON.stringify({ role: "service_role" }))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const result = checkProjectRef(URL, `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`);
    expect(result.keyRef).toBeNull();
    expect(result.matches).toBe(false);
  });
});
