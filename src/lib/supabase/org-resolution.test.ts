import { describe, expect, it } from "vitest";
import { resolveTargetOrganization } from "./org-resolution";

const SERVISIN = "org-servisin";
const JCELLULAR = "org-jcellular";
const KASSERVICE = "org-kasservice";

describe("resolveTargetOrganization", () => {
  // Situasi nyata budi@admin.com: dia membuat ketiga tenant lewat console
  // owner, tapi hanya punya baris employees di satu. Tanpa ini, memilih
  // JCellular diam-diam menampilkan data Servisin.
  it("uses the requested org when the user actually has an assignment there", () => {
    const result = resolveTargetOrganization(JCELLULAR, [
      { organization_id: SERVISIN },
      { organization_id: JCELLULAR },
    ]);
    expect(result).toEqual({ organizationId: JCELLULAR, usedFallback: false, requestedOrgId: JCELLULAR });
  });

  it("falls back but never claims the requested org was used", () => {
    // Ini inti bug yang dilaporkan: user meminta JCellular, assignment-nya
    // hanya Servisin. Hasil WAJIB menandai usedFallback supaya pemanggil tahu
    // pilihannya tidak dihormati.
    const result = resolveTargetOrganization(JCELLULAR, [{ organization_id: SERVISIN }]);
    expect(result).not.toBeNull();
    expect(result!.organizationId).toBe(SERVISIN);
    expect(result!.usedFallback).toBe(true);
    expect(result!.requestedOrgId).toBe(JCELLULAR);
  });

  it("uses the first assignment when no org was requested at all", () => {
    const result = resolveTargetOrganization(null, [
      { organization_id: JCELLULAR },
      { organization_id: KASSERVICE },
    ]);
    expect(result!.organizationId).toBe(JCELLULAR);
    expect(result!.requestedOrgId).toBeNull();
    expect(result!.usedFallback).toBe(true);
  });

  it("treats an empty or whitespace cookie as 'no request'", () => {
    for (const value of ["", "   ", undefined]) {
      const result = resolveTargetOrganization(value, [{ organization_id: KASSERVICE }]);
      expect(result!.organizationId).toBe(KASSERVICE);
      expect(result!.requestedOrgId).toBeNull();
    }
  });

  it("trims the requested id so a padded cookie still matches", () => {
    const result = resolveTargetOrganization(`  ${JCELLULAR}  `, [{ organization_id: JCELLULAR }]);
    expect(result!.organizationId).toBe(JCELLULAR);
    expect(result!.usedFallback).toBe(false);
  });

  it("returns null when the user has no assignment at all", () => {
    // null = pemanggil yang melempar error, karena pesannya bergantung pada
    // konteks (belum punya tenant vs tenant tidak ditemukan).
    expect(resolveTargetOrganization(SERVISIN, [])).toBeNull();
  });

  it("never returns an org the user has no assignment for", () => {
    // Ini yang harus dijamin tanpa syarat: org hasil selalu salah satu dari
    // assignment milik user.
    const assignments = [{ organization_id: SERVISIN }];
    for (const requested of [JCELLULAR, KASSERVICE, "org-palsu", SERVISIN]) {
      const result = resolveTargetOrganization(requested, assignments);
      expect(assignments.map((a) => a.organization_id)).toContain(result!.organizationId);
    }
  });
});
