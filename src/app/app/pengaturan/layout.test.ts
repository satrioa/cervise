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
      entry.href.startsWith("/app/pengaturan") &&
      !entry.href.endsWith("/profil"),
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
  it("MASTER_ADMIN melihat Lokalisasi bersama halaman pengaturan", () => {
    const hrefs = buildSettingsGroups(entriesForRole("MASTER_ADMIN")).flatMap((b) =>
      b.entries.map((e) => e.href),
    );
    expect(hrefs).toContain("/app/pengaturan/lokalisasi");
    expect(hrefs).toContain("/app/pengaturan");
    expect(hrefs).toContain("/app/pengaturan/tampilan");
    expect(hrefs).toContain("/app/pengaturan/subscription");
    expect(hrefs).toContain("/app/pengaturan/usage");
  });

  it("Lokalisasi ada di group akun, halaman sistem ada di group pengaturan", () => {
    const groups = buildSettingsGroups(entriesForRole("MASTER_ADMIN"));
    const akun = groups.find((b) => b.group === "akun");
    const pengaturan = groups.find((b) => b.group === "pengaturan");

    expect(akun?.entries.map((e) => e.href)).toEqual(["/app/pengaturan/lokalisasi"]);
    expect(pengaturan?.entries.map((e) => e.href)).toEqual([
      "/app/pengaturan",
      "/app/pengaturan/tampilan",
      "/app/pengaturan/subscription",
      "/app/pengaturan/usage",
    ]);
  });

  it("profil tidak pernah ikut — halaman itu tidak punya sub-nav", () => {
    const hrefs = buildSettingsGroups(entriesForRole("MASTER_ADMIN")).flatMap((b) =>
      b.entries.map((e) => e.href),
    );
    expect(hrefs).not.toContain("/app/pengaturan/profil");
  });

  it("TECHNICIAN dan FRONTLINER tidak punya sub-sidebar sama sekali", () => {
    // Setelah Lokalisasi dipindah ke System Preferences drawer, tidak ada lagi
    // item pengaturan untuk dua role ini. Layout memakai daftar kosong ini
    // untuk melepas sidebar "Pengaturan Sistem".
    for (const role of ["TECHNICIAN", "FRONTLINER"] as const) {
      expect(buildSettingsGroups(entriesForRole(role)), role).toEqual([]);
    }
  });

  it("ADMIN hanya melihat Lokalisasi, tanpa halaman pengaturan", () => {
    const groups = buildSettingsGroups(entriesForRole("ADMIN"));
    expect(groups).toHaveLength(1);
    expect(groups[0].group).toBe("akun");
    expect(groups[0].entries.map((e) => e.href)).toEqual(["/app/pengaturan/lokalisasi"]);
  });

  it("normalizeAppRole menolak role tak dikenal", () => {
    expect(normalizeAppRole("hacker")).toBeNull();
  });
});
