import { describe, expect, it } from "vitest";
import {
  canAccessActor,
  canWriteActor,
  navFor,
  permissionsForSystemRole,
  sanitizePermissions,
} from "./manifest";

describe("custom role permission enforcement", () => {
  it("role bawaan memakai aturan manifest", () => {
    expect(canAccessActor({ role: "ADMIN" }, "/app/inventori")).toBe(true);
    expect(canAccessActor({ role: "TECHNICIAN" }, "/app/penjualan")).toBe(false);
  });

  it("role buatan dengan izin dipersempit tidak bisa membuka menu yang izinnya dicabut", () => {
    const base = permissionsForSystemRole("ADMIN");
    const narrowed = sanitizePermissions(
      "ADMIN",
      base.filter((permission) => permission !== "products.read"),
    );
    const actor = { role: "ADMIN", permissions: narrowed };

    expect(canAccessActor(actor, "/app/inventori")).toBe(false);
    expect(canAccessActor({ role: "ADMIN" }, "/app/inventori")).toBe(true);
  });

  it("tidak ada izin sama sekali berarti tidak ada akses, bukan akses penuh", () => {
    const actor = { role: "MASTER_ADMIN", permissions: [] as string[] };
    expect(canAccessActor(actor, "/app/karyawan")).toBe(false);
    expect(canWriteActor(actor, "/app/karyawan")).toBe(false);
  });

  it("navFor menghormati daftar izin role buatan", () => {
    const entries = navFor("ADMIN", "legacy", { permissions: [] }).flatMap(
      (block) => block.entries,
    );
    expect(entries.some((entry) => entry.href === "/app/inventori")).toBe(false);
    expect(
      navFor("ADMIN", "legacy")
        .flatMap((block) => block.entries)
        .some((entry) => entry.href === "/app/inventori"),
    ).toBe(true);
  });
});
