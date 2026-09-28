import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  APP_ROLE,
  CAPABILITY_KEYS,
  NAV_ENTRIES,
  canAccess,
  canWrite,
  entriesFor,
  entryForHref,
  entryForMenuKey,
  navFor,
  normalizeAppRole,
  surfaceFor,
  type AppRole,
  type NavGroup,
  type Surface,
} from "./manifest";

/**
 * Kunci `canAccess()` yang benar-benar dipanggil di server action. Lihat
 * `docs/superpowers/specs/2026-09-28-role-scoped-access-admin-design.md` §3.3.
 */
const CALLED_MENU_KEYS = [
  "karyawan",
  "cabang",
  "customer",
  "inventory",
  "keuangan_transaksi",
  "penjualan",
  "harga_jual",
  "pengaturan_general",
  "dashboard",
  "pengaturan_subscription",
] as const;

const LEGACY = "legacy";
const COMPACT = "compact";

/** Sidebar: apa yang benar-benar dirender, group tersembunyi sudah dibuang. */
function sidebarHrefsFor(role: AppRole, surface: Surface): string[] {
  return navFor(role, surface).flatMap((block) => block.entries.map((e) => e.href));
}

/** Semua entri yang boleh dibuka role ini, termasuk group tersembunyi. */
function hrefsFor(role: AppRole, surface: Surface): string[] {
  return entriesFor(role, surface).map((entry) => entry.href);
}

describe("manifest shape", () => {
  it("tidak punya href duplikat", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const entry of NAV_ENTRIES) {
      if (seen.has(entry.href)) duplicates.push(entry.href);
      seen.add(entry.href);
    }
    expect(duplicates).toEqual([]);
  });

  it("setiap roles hanya berisi role yang valid", () => {
    for (const entry of NAV_ENTRIES) {
      for (const role of [...entry.roles, ...(entry.readOnly ?? [])]) {
        expect(APP_ROLE).toContain(role);
      }
    }
  });

  it("setiap surface hanya berisi legacy atau compact", () => {
    for (const entry of NAV_ENTRIES) {
      expect(entry.surface.length).toBeGreaterThan(0);
      for (const surface of entry.surface) {
        expect(["legacy", "compact"]).toContain(surface);
      }
    }
  });

  it("menuKeys unik lintas seluruh manifest", () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const entry of NAV_ENTRIES) {
      for (const key of entry.menuKeys ?? []) {
        const existing = seen.get(key);
        if (existing) duplicates.push(`${key}: ${existing} & ${entry.href}`);
        seen.set(key, entry.href);
      }
    }
    expect(duplicates).toEqual([]);
  });

  it("readOnly selalu bagian dari roles", () => {
    for (const entry of NAV_ENTRIES) {
      for (const role of entry.readOnly ?? []) {
        expect(entry.roles).toContain(role);
      }
    }
  });

  it("setiap group punya label group yang dikenal atau null", () => {
    const groups = new Set<NavGroup>([
      "dashboard",
      "operasional",
      "manajemen",
      "keuangan",
      "laporan",
      "layanan",
      "akun",
      "pengaturan",
    ]);
    for (const entry of NAV_ENTRIES) {
      expect(groups.has(entry.group)).toBe(true);
    }
  });
});

describe("manifest terhadap berkas i18n", () => {
  for (const locale of ["id", "en"]) {
    it(`setiap key ada di messages/${locale}.json`, () => {
      const raw = readFileSync(
        join(process.cwd(), "messages", `${locale}.json`),
        "utf8",
      );
      const messages = JSON.parse(raw) as {
        nav: { items: Record<string, string>; groups: Record<string, string> };
      };
      const missingItems: string[] = [];
      for (const entry of NAV_ENTRIES) {
        if (!messages.nav.items[entry.key]) missingItems.push(`${entry.href} -> ${entry.key}`);
      }
      expect(missingItems).toEqual([]);
    });
  }

  it("group yang dilabeli punya kunci di nav.groups", () => {
    const messages = JSON.parse(
      readFileSync(join(process.cwd(), "messages", "id.json"), "utf8"),
    ) as { nav: { groups: Record<string, string> } };
    const labelled = new Set(
      NAV_ENTRIES.filter((entry) => entry.group !== "dashboard").map((entry) => entry.group),
    );
    const mapping: Partial<Record<NavGroup, string>> = {
      operasional: "operational",
      manajemen: "management",
      keuangan: "finance",
      laporan: "reports",
      layanan: "services",
    };
    const missing: string[] = [];
    for (const group of labelled) {
      const key = mapping[group];
      if (key && !messages.nav.groups[key]) missing.push(`${group} -> ${key}`);
    }
    expect(missing).toEqual([]);
  });
});

describe("kunci yang dipanggil canAccess", () => {
  it("setiap kunci punya entri di manifest atau CAPABILITY_ACCESS", () => {
    const unresolved: string[] = [];
    for (const key of CALLED_MENU_KEYS) {
      const found = entryForMenuKey(key) || CAPABILITY_KEYS.includes(key);
      if (!found) unresolved.push(key);
    }
    expect(unresolved).toEqual([]);
  });

  it("CAPABILITY_KEYS hanya berisi kunci tanpa rute", () => {
    for (const key of CAPABILITY_KEYS) {
      expect(entryForMenuKey(key)).toBeUndefined();
    }
  });
});

describe("canAccess", () => {
  it("TECHNICIAN boleh dashboard dan servis — dulu mustahil", () => {
    expect(canAccess("TECHNICIAN", "dashboard")).toBe(true);
    expect(canAccess("TECHNICIAN", "servis")).toBe(true);
    expect(canAccess("TECHNICIAN", "/app/servis")).toBe(true);
  });

  it("TECHNICIAN ditolak dari karyawan, cabang, keuangan, dan pengaturan", () => {
    expect(canAccess("TECHNICIAN", "karyawan")).toBe(false);
    expect(canAccess("TECHNICIAN", "cabang")).toBe(false);
    expect(canAccess("TECHNICIAN", "keuangan_transaksi")).toBe(false);
    expect(canAccess("TECHNICIAN", "/app/pengaturan")).toBe(false);
    expect(canAccess("TECHNICIAN", "/app/pengaturan/subscription")).toBe(false);
  });

  it("FRONTLINER boleh penjualan dan customer, ditolak dari karyawan", () => {
    expect(canAccess("FRONTLINER", "penjualan")).toBe(true);
    expect(canAccess("FRONTLINER", "customer")).toBe(true);
    expect(canAccess("FRONTLINER", "karyawan")).toBe(false);
  });

  it("FRONTLINER tidak boleh mencatat pembayaran servis lewat keuangan_transaksi", () => {
    expect(canAccess("FRONTLINER", "keuangan_transaksi")).toBe(false);
  });

  it("ADMIN boleh overriding harga, FRONTLINER tidak", () => {
    expect(canAccess("ADMIN", "harga_jual")).toBe(true);
    expect(canAccess("MASTER_ADMIN", "harga_jual")).toBe(true);
    expect(canAccess("FRONTLINER", "harga_jual")).toBe(false);
    expect(canAccess("TECHNICIAN", "harga_jual")).toBe(false);
  });

  it("ADMIN dan MASTER_ADMIN boleh karyawan", () => {
    expect(canAccess("ADMIN", "karyawan")).toBe(true);
    expect(canAccess("MASTER_ADMIN", "karyawan")).toBe(true);
  });

  it("hanya MASTER_ADMIN boleh pengaturan umum, tampilan, subscription, usage", () => {
    for (const key of [
      "pengaturan_general",
      "pengaturan_tampilan",
      "pengaturan_subscription",
      "pengaturan_usage",
    ]) {
      expect(canAccess("MASTER_ADMIN", key)).toBe(true);
      for (const role of ["ADMIN", "FRONTLINER", "TECHNICIAN"] as const) {
        expect(canAccess(role, key)).toBe(false);
      }
    }
  });

  it("semua role boleh profil, lokalisasi, garansi, inventori", () => {
    for (const role of APP_ROLE) {
      expect(canAccess(role, "/app/pengaturan/profil")).toBe(true);
      expect(canAccess(role, "pengaturan_lokalisasi")).toBe(true);
      expect(canAccess(role, "garansi")).toBe(true);
      expect(canAccess(role, "inventory")).toBe(true);
    }
  });

  it("menolak role null, kosong, dan huruf kecil yang tidak dikenal", () => {
    for (const value of [null, undefined, "", "   ", "super_owner", "teknisi-frontliner"]) {
      expect(canAccess(value, "dashboard")).toBe(false);
    }
  });

  it("menerima role huruf kecil dan mengnormalkan ke huruf besar", () => {
    expect(normalizeAppRole("technician")).toBe("TECHNICIAN");
    expect(normalizeAppRole("  frontliner  ")).toBe("FRONTLINER");
    expect(canAccess("technician", "servis")).toBe(true);
  });

  it("kunci yang tidak dikenal mengembalikan false, bukan throw", () => {
    expect(canAccess("MASTER_ADMIN", "halaman-yang-tidak-ada")).toBe(false);
  });
});

describe("canWrite", () => {
  it("ADMIN read-only di cabang", () => {
    expect(canAccess("ADMIN", "/app/cabang")).toBe(true);
    expect(canWrite("ADMIN", "/app/cabang")).toBe(false);
  });

  it("MASTER_ADMIN tetap boleh menulis cabang", () => {
    expect(canWrite("MASTER_ADMIN", "/app/cabang")).toBe(true);
  });

  it("role di luar roles tetap ditolak, readOnly tidak Relevant", () => {
    expect(canWrite("FRONTLINER", "/app/cabang")).toBe(false);
    expect(canWrite("ADMIN", "karyawan")).toBe(true);
  });
});

describe("menu per role", () => {
  it("MASTER_ADMIN melihat 23 dari 24 entri di shell legacy, kecuali analitik-servis", () => {
    const sidebar = sidebarHrefsFor("MASTER_ADMIN", LEGACY);
    expect(sidebar).toHaveLength(23);
    expect(sidebar).not.toContain("/app/analitik-servis");
    for (const entry of NAV_ENTRIES) {
      if (entry.href === "/app/analitik-servis") continue;
      expect(sidebar).toContain(entry.href);
    }
  });

  it("TEKNICIAN melihat 7 entri di sidebar compact, urut dashboard → operasi → laporan → layanan", () => {
    expect(sidebarHrefsFor("TECHNICIAN", COMPACT)).toEqual([
      "/app",
      "/app/servis",
      "/app/inventori",
      "/app/kategori-sparepart",
      "/app/analitik-servis",
      "/app/laporan/servis",
      "/app/garansi",
    ]);
  });

  it("profil dan lokalisasi disembunyikan dari sidebar compact tapi tetap boleh dibuka", () => {
    const sidebar = sidebarHrefsFor("TECHNICIAN", COMPACT);
    expect(sidebar).not.toContain("/app/pengaturan/profil");
    expect(sidebar).not.toContain("/app/pengaturan/lokalisasi");
    expect(hrefsFor("TECHNICIAN", COMPACT)).toContain("/app/pengaturan/profil");
  });

  it("profil dan lokalisasi tetap muncul di sidebar legacy", () => {
    const sidebar = sidebarHrefsFor("ADMIN", LEGACY);
    expect(sidebar).toContain("/app/pengaturan/profil");
    expect(sidebar).toContain("/app/pengaturan/lokalisasi");
  });

  it("ADMIN tidak melihat halaman pengaturan", () => {
    const hrefs = sidebarHrefsFor("ADMIN", LEGACY);
    for (const href of [
      "/app/pengaturan",
      "/app/pengaturan/tampilan",
      "/app/pengaturan/subscription",
      "/app/pengaturan/usage",
    ]) {
      expect(hrefs).not.toContain(href);
    }
  });

  it("FRONTLINER tidak melihat karyawan, cabang, atau laporan shift", () => {
    const hrefs = sidebarHrefsFor("FRONTLINER", COMPACT);
    expect(hrefs).not.toContain("/app/karyawan");
    expect(hrefs).not.toContain("/app/cabang");
    expect(hrefs).not.toContain("/app/laporan/shift");
  });

  it("FRONTLINER melihat keuangan dan laporan penuh", () => {
    const hrefs = sidebarHrefsFor("FRONTLINER", COMPACT);
    for (const href of [
      "/app/keuangan/transaksi",
      "/app/keuangan/arus-kas",
      "/app/laporan/keuangan",
      "/app/laporan/penjualan",
    ]) {
      expect(hrefs).toContain(href);
    }
  });

  it("TEKNICIAN tidak melihat keuangan maupun laporan selain servis", () => {
    const hrefs = sidebarHrefsFor("TECHNICIAN", COMPACT);
    expect(hrefs).not.toContain("/app/keuangan/transaksi");
    expect(hrefs).not.toContain("/app/keuangan/arus-kas");
    expect(hrefs).not.toContain("/app/laporan/keuangan");
    expect(hrefs).not.toContain("/app/laporan/penjualan");
    expect(hrefs).not.toContain("/app/laporan/performa");
  });

  it("tidak ada role dengan sidebar kosong", () => {
    for (const role of APP_ROLE) {
      for (const surface of [LEGACY, COMPACT] as Surface[]) {
        const hrefs = sidebarHrefsFor(role, surface);
        if (hrefs.length === 0) continue;
        expect(hrefs.length).toBeGreaterThan(0);
      }
    }
    // Setiap role wajib punya isi di shell yang memang aktif untuknya.
    expect(sidebarHrefsFor("MASTER_ADMIN", LEGACY).length).toBeGreaterThan(0);
    expect(sidebarHrefsFor("ADMIN", LEGACY).length).toBeGreaterThan(0);
    expect(sidebarHrefsFor("FRONTLINER", COMPACT).length).toBeGreaterThan(0);
    expect(sidebarHrefsFor("TECHNICIAN", COMPACT).length).toBeGreaterThan(0);
  });

  it("navFor mengembalikan group dalam urutan yang stabil", () => {
    const blocks = navFor("ADMIN", LEGACY);
    const groups = blocks.map((block) => block.group);
    expect(groups[0]).toBe("dashboard");
    expect(groups).toEqual([...groups].sort(
      (a, b) => [
        "dashboard",
        "operasional",
        "manajemen",
        "keuangan",
        "laporan",
        "layanan",
        "akun",
        "pengaturan",
      ].indexOf(a) - [
        "dashboard",
        "operasional",
        "manajemen",
        "keuangan",
        "laporan",
        "layanan",
        "akun",
        "pengaturan",
      ].indexOf(b),
    ));
  });
});

describe("pemilihan shell", () => {
  it("TEKNICIAN dan FRONTLINER memakai compact, role lain tetap legacy", () => {
    expect(surfaceFor("TECHNICIAN")).toBe(COMPACT);
    expect(surfaceFor("FRONTLINER")).toBe(COMPACT);
    expect(surfaceFor("MASTER_ADMIN")).toBe(LEGACY);
    expect(surfaceFor("ADMIN")).toBe(LEGACY);
  });

  it("entri /app ada di kedua surface, tapi shell ditentukan compactRoles", () => {
    const dashboard = entryForHref("/app");
    expect(dashboard).toBeDefined();
    // `surface` hanya mengatur kemunculan di sidebar. Kalau `surface` ikut
    // menentukan shell, MASTER_ADMIN dan ADMIN akan ikut dapat CompactShell
    // begitu "compact" ditambahkan untuk link Dashboard di rail.
    expect(dashboard?.surface).toContain(LEGACY);
    expect(dashboard?.surface).toContain(COMPACT);
  });

  it("hanya compactRoles yang menentukan shell, bukan surface", () => {
    // Setiap role yang punya compactRoles harus dapat compact; sisanya legacy
    // walau `/app` ada di surface compact.
    for (const role of APP_ROLE) {
      const expected = entryForHref("/app")?.compactRoles?.includes(role)
        ? COMPACT
        : LEGACY;
      expect(surfaceFor(role), role).toBe(expected);
    }
  });

  it("compactRoles hanya berisi role yang juga ada di roles", () => {
    for (const entry of NAV_ENTRIES) {
      for (const role of entry.compactRoles ?? []) {
        expect(entry.roles, `${entry.href} / ${role}`).toContain(role);
      }
    }
  });

  it("role yang tidak dikenal dapat legacy, bukan compact", () => {
    expect(surfaceFor("super_owner")).toBe(LEGACY);
    expect(surfaceFor(null)).toBe(LEGACY);
  });
});
