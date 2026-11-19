import { describe, expect, it } from "vitest";
import { buildCustomPackageWhatsAppUrl, CUSTOM_PACKAGE_MESSAGE } from "./custom-package-whatsapp";

describe("buildCustomPackageWhatsAppUrl", () => {
  it("mengarah ke harga bila nomor belum diisi", () => {
    expect(buildCustomPackageWhatsAppUrl(undefined)).toBe("#harga");
    expect(buildCustomPackageWhatsAppUrl("  ")).toBe("#harga");
  });

  it("membuat link wa.me dengan pesan template ter-encode", () => {
    const url = new URL(buildCustomPackageWhatsAppUrl("+62 812-3456-7890"));
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/6281234567890");
    expect(url.searchParams.get("text")).toBe(CUSTOM_PACKAGE_MESSAGE);
    expect(url.searchParams.get("text")).toContain("Jumlah cabang:");
  });
});
