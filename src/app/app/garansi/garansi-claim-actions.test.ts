import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/app/garansi/actions.ts"), "utf8");

function bodyOf(name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  expect(source, name).not.toBe(-1);
  return source.slice(start);
}

describe("aksi klaim garansi", () => {
  it("createGaransiClaim memakai helper eligibility dan otorisasi manager", () => {
    const body = bodyOf("createGaransiClaim");
    expect(body).toContain("isManagerRole(role)");
    expect(body).toContain("canClaimGaransi(");
    expect(body).toContain('.eq("branch_id", branchId)');
    expect(body).toContain("Alasan klaim wajib diisi");
  });

  it("servis klaim gratis dan tidak membuat garansi baru", () => {
    const body = bodyOf("createGaransiClaim");
    expect(body).toContain("price: 0");
    expect(body).toContain("price_estimasi: 0");
    expect(body).toContain("parent_service_id: service.id");
    expect(body).toContain("garansi_value: null");
    expect(body).toContain('rpc("next_service_number"');
  });

  it("mencatat klaim, log, dan menyegarkan cache", () => {
    const body = bodyOf("createGaransiClaim");
    expect(body).toContain('from("garansi_claims")');
    expect(body).toContain('from("cervise_service_logs")');
    expect(body).toContain('revalidatePath("/app/garansi")');
    expect(body).toContain('revalidatePath("/app/servis")');
  });

  it("getGaransiClaims mengembalikan status turunan dari servis klaim", () => {
    const body = bodyOf("getGaransiClaims");
    expect(body).toContain("new_service_id");
    expect(body).toContain("status");
    expect(body).toContain("applyBranchScope");
  });
});
