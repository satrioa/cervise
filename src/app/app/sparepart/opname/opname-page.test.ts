import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");
const list = read("src/app/app/inventori/opname/opname-client.tsx");

describe("OpnameClient dengan domain terkunci", () => {
  it("menerima lockedDomain dan memakainya sebagai state awal", () => {
    expect(list).toContain("lockedDomain?: Domain");
    expect(list).toContain('useState<Domain>(lockedDomain ?? "product")');
  });

  it("menyembunyikan tab saat terkunci dan tetap memakai SessionList", () => {
    expect(list).toContain("{lockedDomain ? (");
    expect(list).toContain("sessions={sessions[lockedDomain]}");
    expect(list).toContain("<TabsList>");
  });
});

const page = read("src/app/app/sparepart/opname/page.tsx");
const sparepart = read("src/app/app/sparepart/sparepart-client.tsx");

describe("halaman opname sparepart", () => {
  it("memakai guard menu dan hanya memuat sesi sparepart", () => {
    expect(page).toContain('requireMenu("kategori_sparepart")');
    expect(page).toContain('listSessions("sparepart")');
    expect(page).toContain('lockedDomain="sparepart"');
    expect(page).toContain("products={[]}");
    expect(page).toContain("OPNAME_POSTER_ROLES");
  });

  it("tombol di halaman Sparepart menuju rute baru", () => {
    expect(sparepart).toContain('href="/app/sparepart/opname"');
    expect(sparepart).toContain("PackageCheckIcon");
    expect(sparepart).toContain("Stock Opname");
  });
});
