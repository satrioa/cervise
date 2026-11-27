import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("UI klaim garansi", () => {
  const dialog = read("src/components/servis/garansi-claim-dialog.tsx");
  const client = read("src/app/app/garansi/garansi-client.tsx");
  const list = read("src/app/app/garansi/garansi-claim-list.tsx");

  it("dialog berisi alasan klaim, ringkasan gratis, dan submit", () => {
    expect(dialog).toContain("Alasan klaim");
    expect(dialog).toContain("Gratis");
    expect(dialog).toContain("createGaransiClaim");
    expect(dialog).toContain("<Textarea");
    expect(dialog).toContain("Batal");
  });

  it("tabel garansi punya tombol klaim yang memakai eligibility", () => {
    expect(client).toContain("Klaim garansi");
    expect(client).toContain("canClaimGaransi");
    expect(client).toContain("getGaransiClaims");
    expect(client).toContain("<GaransiClaimDialog");
    expect(client).toContain("<GaransiClaimList");
  });

  it("riwayat klaim menampilkan status turunan dan tautan servis", () => {
    expect(list).toContain("Status klaim");
    expect(list).toContain("/app/servis/");
    expect(list).toContain("claim.status");
  });
});
