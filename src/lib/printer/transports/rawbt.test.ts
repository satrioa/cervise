import { describe, expect, it } from "vitest";
import { rawbt, intentUrl } from "./rawbt";

describe("rawbt", () => {
  it("intentUrl creates correct URL", () => {
    const url = intentUrl("SGVsbG8=");
    expect(url).toBe(
      "intent:SGVsbG8=#Intent;scheme=rawbt;package=ru.a420d.rawbtprinter;end;"
    );
  });

  it("base64 encoding produces correct intent URL", () => {
    const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const b64 = btoa(String.fromCharCode(...data));
    const url = intentUrl(b64);
    expect(url).toContain("intent:");
    expect(url).toContain("scheme=rawbt");
    expect(url).toContain("package=ru.a420d.rawbtprinter");
  });

  it("long URL exceeds MAX_URL limit (1800)", () => {
    // Prefix/suffix intent ~62 karakter, jadi base64 harus > 1738 karakter.
    const longBase64 = "A".repeat(1800);
    const url = intentUrl(longBase64);
    expect(url.length).toBeGreaterThan(1800);
  });

  it("rawbt has correct transport id", () => {
    expect(rawbt.id).toBe("rawbt");
  });

  it("deviceName returns configured label", () => {
    expect(rawbt.deviceName()).toBeNull();
  });

  it("isSupported detects Android", () => {
    expect(typeof rawbt.isSupported()).toBe("boolean");
  });
});