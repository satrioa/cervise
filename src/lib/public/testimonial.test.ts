import { describe, expect, it } from "vitest";
import { safeExternalUrl } from "./testimonial";

describe("safeExternalUrl", () => {
  it("menerima URL http dan https", () => {
    expect(safeExternalUrl("https://instagram.com/jcellular.id")).toBe("https://instagram.com/jcellular.id");
    expect(safeExternalUrl("http://example.com")).toBe("http://example.com");
  });

  it("memangkas spasi di sekeliling", () => {
    expect(safeExternalUrl("  https://example.com  ")).toBe("https://example.com");
  });

  it("menolak skema javascript, data, vbscript, dan file", () => {
    for (const jahat of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ]) {
      expect(safeExternalUrl(jahat), jahat).toBeNull();
    }
  });

  it("menolak URL relatif dan protocol-relative", () => {
    for (const relatif of ["/admin", "//evil.com", "instagram.com/x", "example.com"]) {
      expect(safeExternalUrl(relatif), relatif).toBeNull();
    }
  });

  it("menolak nilai kosong", () => {
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl("   ")).toBeNull();
  });

  it("menolak nilai bertipe selain string", () => {
    expect(safeExternalUrl(42 as unknown as string)).toBeNull();
    expect(safeExternalUrl({} as unknown as string)).toBeNull();
  });
});
