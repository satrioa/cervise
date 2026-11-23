import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const actions = read("src/app/owner/actions.ts");
const dialog = read("src/components/owner/create-tenant-dialog.tsx");
const credentialsDialog = read("src/components/temp-password-dialog.tsx");

describe("create tenant membuat kredensial owner", () => {
  it("menolak email yang sudah terdaftar", () => {
    const start = actions.indexOf("export async function createTenant");
    const body = actions.slice(start, start + 1600);
    expect(body).toContain("if (existing)");
    expect(body).toContain("Email sudah terdaftar");
    expect(body).not.toContain("ownerId = existing.id");
  });

  it("selalu membuat akun dengan password generated", () => {
    const start = actions.indexOf("export async function createTenant");
    const body = actions.slice(start, start + 2200);
    expect(body).toContain("generateTempPassword()");
    expect(body).toContain("password: tempPassword");
    expect(body).toContain("tempPassword,");
    expect(body).not.toContain("tempPassword ?? undefined");
  });
});

describe("dialog kredensial setelah tenant dibuat", () => {
  it("password ditampilkan lewat dialog copy email + password", () => {
    expect(dialog).toContain("<TempPasswordDialog");
    expect(dialog).toContain("password={created?.tempPassword ?? \"\"}");
    expect(credentialsDialog).toContain("buildAccountCredentialsText");
  });

  it("modal dipasang sebelum router.refresh()", () => {
    const setCreated = dialog.indexOf("setCreated({ email: result.ownerEmail");
    const refresh = dialog.indexOf("router.refresh()", setCreated);
    expect(setCreated).toBeGreaterThan(-1);
    expect(refresh).toBeGreaterThan(setCreated);
    expect(dialog).not.toContain("reusedExistingAccount");
  });
});
