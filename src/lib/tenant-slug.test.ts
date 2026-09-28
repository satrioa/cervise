import { describe, expect, it } from "vitest";
import { isTenantOwner } from "./tenant-slug";

/**
 * Ownership tenant dan role operasional sengaja dipisah. Fungsi ini yang
 * menjawab "apakah user ini pemilik tenant" - sumbernya kolom
 * organizations.owner_profile_id, bukan employees.role.
 *
 * Kalau ini diam-diam memakai role, MASTER_ADMIN akan berarti pemilik, dan
 * masalah yang asli (siapa yang membayar vs siapa yang mengurus) kembali
 * muncul.
 */
describe("isTenantOwner", () => {
  it("benar saat profil pengguna cocok dengan owner_profile_id", () => {
    expect(isTenantOwner("user-1", "user-1")).toBe(true);
  });

  it("salah saat user lain", () => {
    expect(isTenantOwner("user-1", "user-2")).toBe(false);
  });

  it("menolak tenant yang owner_profile_id-nya kosong, bukan menebak", () => {
    // Tenant lama sebelum backfill, atau tenant yang dibuat tanpa pemilik
    // tercatat. Menebak "ya, berarti dia owner" di sini akan memberi hak
    // tagihan ke orang yang salah.
    expect(isTenantOwner(null, "user-1")).toBe(false);
    expect(isTenantOwner(undefined, "user-1")).toBe(false);
    expect(isTenantOwner("", "user-1")).toBe(false);
  });

  it("menolak user id yang kosong", () => {
    expect(isTenantOwner("user-1", null)).toBe(false);
    expect(isTenantOwner("user-1", undefined)).toBe(false);
  });

  it("tidak mempertimbangkan role sama sekali, jadi MASTER_ADMIN tidak otomatis jadi owner", () => {
    // Perilaku yang salah yang harus dicegah: user yang hanya punya
    // employees.role = MASTER_ADMIN, tanpa jadi owner_profile_id.
    expect(isTenantOwner(null, "user-1")).toBe(false);
  });

  it("bersifat case-sensitive untuk uuid, seperti kolomnya", () => {
    expect(isTenantOwner("USER-1", "user-1")).toBe(false);
  });
});
