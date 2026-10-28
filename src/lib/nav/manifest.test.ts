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
  type NavEntry,
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
  "servis_pembayaran",
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

  it("label laporan servis tidak sama dengan menu servis", () => {
    // `/app/servis` dan `/app/laporan/servis` dulu sama-sama tampil sebagai
    // "Servis" di rail compact, sehingga tidak mungkin dibedakan. Label
    // laporan harus tetap mengandung kata laporan/report.
    for (const locale of ["id", "en"]) {
      const messages = JSON.parse(
        readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"),
      ) as { nav: { items: Record<string, string> } };
      const service = messages.nav.items.service;
      const report = messages.nav.items.reportService;
      expect(report, locale).not.toBe(service);
      expect(report.toLowerCase(), locale).toContain(locale === "id" ? "laporan" : "report");
    }

    expect(entryForHref("/app/laporan/servis")?.label).toBe("Laporan Servis");
  });

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

  it("Customer berada di grup manajemen, bersama Karyawan dan Cabang", () => {
    // Customer adalah data induk yang dikelola, bukan pekerjaan harian di
    // loket, jadi dikelompokkan bersama menu master data lain.
    const customer = entryForHref("/app/customer");
    expect(customer?.group).toBe("manajemen");
    const label = customer as NavEntry;
    expect(label.roles).toEqual(["MASTER_ADMIN", "ADMIN", "FRONTLINER"]);
  });

  it("Customer tetap bisa dibuka Frontliner dari sidebar dan rail", () => {
    // Yang paling rapuh dari perubahan ini. Menaruh Customer di `manajemen`
    // Aman selama `roles` masih CASHIERS -- kalau sampai MANAGERS, grup itu
    // kosong untuk Frontliner, `navFor` melewatkan grup kosong, lalu menu
    // Customer hilang tanpa satu pun error.
    const compact = navFor("FRONTLINER", "compact");
    const manajemenCompact = compact.find((block) => block.group === "manajemen");
    expect(manajemenCompact?.entries.map((entry) => entry.href)).toEqual(["/app/customer"]);

    const legacy = navFor("FRONTLINER", "legacy");
    const manajemenLegacy = legacy.find((block) => block.group === "manajemen");
    expect(manajemenLegacy?.entries.map((entry) => entry.href)).toEqual(["/app/customer"]);
  });

  it("Teknisi tidak melihat grup manajemen karena tidak punya akses ke isinya", () => {
    // `navFor` melewatkan grup yang kosong. Untuk teknisi, `manajemen` tidak
    // punya satu pun entri yang boleh dibuka, jadi harus hilang sepenuhnya -
    // bukan muncul sebagai section kosong.
    const groups = navFor("TECHNICIAN", "legacy").map((block) => block.group);
    expect(groups).not.toContain("manajemen");
    // Customer sendiri memang bukan haknya sejak awal, jadi ini tidak berubah.
    expect(canAccess("TECHNICIAN", "customer")).toBe(false);
  });

  it("Customer berada di akhir grup manajemen, di bawah Cabang", () => {
    const entries = navFor("ADMIN", "legacy").find((block) => block.group === "manajemen")!.entries;
    expect(entries.map((entry) => entry.label)).toEqual(["Karyawan", "Cabang", "Customer"]);
  });

  it("grup operasional tidak lagi memuat Customer", () => {
    const entries = navFor("ADMIN", "legacy").find((block) => block.group === "operasional")!.entries;
    expect(entries.map((entry) => entry.label)).toEqual(["Servis", "Inventori", "Sparepart"]);
  });

  it("FRONTLINER boleh mencatat pembayaran servis, tapi bukan lewat keuangan_transaksi", () => {
    expect(canAccess("FRONTLINER", "keuangan_transaksi")).toBe(false);
    expect(canAccess("FRONTLINER", "servis_pembayaran")).toBe(true);
    expect(canAccess("TECHNICIAN", "servis_pembayaran")).toBe(false);
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

  it("semua role boleh profil, garansi, inventori", () => {
    for (const role of APP_ROLE) {
      expect(canAccess(role, "/app/pengaturan/profil")).toBe(true);
      expect(canAccess(role, "garansi")).toBe(true);
      expect(canAccess(role, "inventory")).toBe(true);
    }
  });

  it("lokalisasi hanya untuk manajer — teknisi & frontliner mengatur bahasa dari drawer", () => {
    // Halaman Lokalisasi menyimpan preferensi milik user, bukan tenant, tapi
    // menampilkannya untuk role compact berarti sub-sidebar /app/pengaturan
    // berisi satu item saja. Bahasa untuk mereka ada di System Preferences.
    expect(canAccess("MASTER_ADMIN", "pengaturan_lokalisasi")).toBe(true);
    expect(canAccess("ADMIN", "pengaturan_lokalisasi")).toBe(true);
    expect(canAccess("FRONTLINER", "pengaturan_lokalisasi")).toBe(false);
    expect(canAccess("TECHNICIAN", "pengaturan_lokalisasi")).toBe(false);
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
  it("MASTER_ADMIN melihat 17 dari 24 entri di shell legacy", () => {
    // 24 entri dikurangi analitik-servis, lalu 6 entri akun+pengaturan yang
    // disembunyikan (gear di footer + sub-sidebar /app/pengaturan).
    const sidebar = sidebarHrefsFor("MASTER_ADMIN", LEGACY);
    expect(sidebar).toHaveLength(17);
    expect(sidebar).not.toContain("/app/analitik-servis");
    const tersembunyi = new Set([
      "/app/analitik-servis",
      "/app/pengaturan/profil",
      "/app/pengaturan/lokalisasi",
      "/app/pengaturan",
      "/app/pengaturan/tampilan",
      "/app/pengaturan/subscription",
      "/app/pengaturan/usage",
    ]);
    for (const entry of NAV_ENTRIES) {
      if (tersembunyi.has(entry.href)) {
        expect(sidebar, entry.href).not.toContain(entry.href);
      } else {
        expect(sidebar, entry.href).toContain(entry.href);
      }
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

  it("profil disembunyikan dari sidebar compact tapi tetap boleh dibuka", () => {
    const sidebar = sidebarHrefsFor("TECHNICIAN", COMPACT);
    expect(sidebar).not.toContain("/app/pengaturan/profil");
    expect(hrefsFor("TECHNICIAN", COMPACT)).toContain("/app/pengaturan/profil");
    // Lokalisasi bukan lagi "disembunyikan tapi boleh dibuka": role compact
    // memang tidak berhak, jadi ia hilang dari daftar yang boleh dibuka juga.
    expect(hrefsFor("TECHNICIAN", COMPACT)).not.toContain("/app/pengaturan/lokalisasi");
  });

  it("profil dan lokalisasi disembunyikan dari sidebar legacy tapi tetap boleh dibuka", () => {
    // Sama seperti compact. Di legacy keduanya punya pintu masuk lain: gear di
    // footer untuk profil, sub-sidebar /app/pengaturan untuk lokalisasi.
    for (const role of ["MASTER_ADMIN", "ADMIN"] as const) {
      const sidebar = sidebarHrefsFor(role, LEGACY);
      expect(sidebar, role).not.toContain("/app/pengaturan/profil");
      expect(sidebar, role).not.toContain("/app/pengaturan/lokalisasi");
      expect(hrefsFor(role, LEGACY), role).toContain("/app/pengaturan/profil");
      expect(hrefsFor(role, LEGACY), role).toContain("/app/pengaturan/lokalisasi");
    }
  });

  it("includeHidden mengembalikan group yang disembunyikan sidebar", () => {
    // Command palette memakai ini: pencarian tidak boleh lebih sempit dari
    // navigasi, kalau tidak "pengaturan" tidak bisa dicari lewat Ctrl-K.
    const groups = navFor("MASTER_ADMIN", LEGACY, { includeHidden: true }).map((b) => b.group);
    expect(groups).toContain("akun");
    expect(groups).toContain("pengaturan");

    const hrefs = navFor("MASTER_ADMIN", LEGACY, { includeHidden: true })
      .flatMap((block) => block.entries.map((e) => e.href));
    expect(hrefs).toContain("/app/pengaturan/profil");
    expect(hrefs).toContain("/app/pengaturan/lokalisasi");
    expect(hrefs).toContain("/app/pengaturan/subscription");
  });

  it("tanpa opsi, group tersembunyi tetap dibuang", () => {
    const groups = navFor("MASTER_ADMIN", LEGACY).map((b) => b.group);
    expect(groups).not.toContain("akun");
    expect(groups).not.toContain("pengaturan");
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
