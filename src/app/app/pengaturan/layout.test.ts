import { describe, expect, it } from "vitest";
import { NAV_ENTRIES, normalizeAppRole, type AppRole } from "@/lib/nav/manifest";
import { buildSettingsGroups } from "./layout";

/**
 * Layout ini adalah Server Component (memakai `getActiveTenant()`), sedangkan
 * `SettingsNav` adalah Client Component. React hanya boleh menerima plain
 * object di batas itu — fungsi (seperti komponen `icon` pada `NavEntry`) akan
 * ditolak dengan:
 *
 *   Only plain objects can be passed to Client Components from Server
 *   Components.
 *
 * Bug ini lolos beberapa commit karena tidak ada test-nya. `structuredClone`
 * dipakai sebagai pengganti: ia melempar `DataCloneError` persis pada fungsi,
 * jadi ia menguji properti yang sama tanpa perlu merender React.
 */
function entriesForRole(role: AppRole) {
  return NAV_ENTRIES.filter(
    (entry) =>
      entry.surface.includes("legacy") &&
      entry.roles.includes(role) &&
      entry.href.startsWith("/app/pengaturan"),
  );
}

describe("payload SettingsNav", () => {
  it("harus bisa diserialisasi lintas batas Server/Client", () => {
    const groups = buildSettingsGroups(entriesForRole("MASTER_ADMIN"));
    expect(groups.length).toBeGreaterThan(0);
    expect(() => structuredClone(groups)).not.toThrow();
  });

  it("kontrol negatif: structuredClone memang menangkap fungsi", () => {
    // Tanpa ini, test di atas bisa hijau karena alasan yang salah.
    expect(() => structuredClone([{ icon: () => null }])).toThrow();
  });

  it("entri yang dikirim tidak boleh membawa ikon", () => {
    const groups = buildSettingsGroups(entriesForRole("MASTER_ADMIN"));
    for (const block of groups) {
      for (const entry of block.entries) {
        expect(Object.keys(entry).sort(), entry.href).toEqual(["href", "label"]);
      }
    }
  });

  it("NAV_ENTRIES yang mentah memang tidak bisa diserialisasi", () => {
    // Menahan test di atas tetap jujur: masalahnya ada di datanya.
    expect(() => structuredClone(entriesForRole("MASTER_ADMIN"))).toThrow();
  });
});

describe("isi sub-sidebar", () => {
  it("MASTER_ADMIN melihat akun dan pengaturan tenant terpisah", () => {
    const hrefs = buildSettingsGroups(entriesForRole("MASTER_ADMIN")).flatMap((b) =>
      b.entries.map((e) => e.href),
    );
    expect(hrefs).toContain("/app/pengaturan/profil");
    expect(hrefs).toContain("/app/pengaturan/lokalisasi");
    expect(hrefs).toContain("/app/pengaturan");
    expect(hrefs).toContain("/app/pengaturan/tampilan");
    expect(hrefs).toContain("/app/pengaturan/subscription");
    expect(hrefs).toContain("/app/pengaturan/usage");
  });

  it("Akun dan Pengaturan Tenant dipisah dengan label yang jelas", () => {
    const groups = buildSettingsGroups(entriesForRole("MASTER_ADMIN"));
    const akun = groups.find((b) => b.group === "akun");
    const pengaturan = groups.find((b) => b.group === "pengaturan");

    expect(akun?.label).toBe("Akun");
    expect(akun?.entries.map((e) => e.href)).toEqual([
      "/app/pengaturan/profil",
      "/app/pengaturan/lokalisasi",
    ]);
    expect(pengaturan?.label).toBe("Pengaturan Tenant");
    expect(pengaturan?.entries.map((e) => e.href)).toEqual([
      "/app/pengaturan",
      "/app/pengaturan/tampilan",
      "/app/pengaturan/subscription",
      "/app/pengaturan/usage",
      "/app/pengaturan/role",
    ]);
  });

  it("TECHNICIAN dan FRONTLINER hanya melihat akun profil", () => {
    for (const role of ["TECHNICIAN", "FRONTLINER"] as const) {
      const groups = buildSettingsGroups(entriesForRole(role));
      expect(groups).toHaveLength(1);
      expect(groups[0].group).toBe("akun");
      expect(groups[0].entries.map((e) => e.href)).toEqual(["/app/pengaturan/profil"]);
    }
  });

  it("ADMIN melihat akun (profil, lokalisasi) dan role & izin tenant", () => {
    const groups = buildSettingsGroups(entriesForRole("ADMIN"));
    expect(groups.map((g) => g.group)).toEqual(["akun", "pengaturan"]);
    expect(groups[0].entries.map((e) => e.href)).toEqual([
      "/app/pengaturan/profil",
      "/app/pengaturan/lokalisasi",
    ]);
    expect(groups[1].entries.map((e) => e.href)).toEqual(["/app/pengaturan/role"]);
  });

  it("normalizeAppRole menolak role tak dikenal", () => {
    expect(normalizeAppRole("hacker")).toBeNull();
  });
});
