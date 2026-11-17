import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");
const list = read("src/app/app/inventori/opname/opname-client.tsx");
const detail = read("src/app/app/inventori/opname/[id]/page.tsx");
const panel = read("src/components/inventori/opname-count-panel.tsx");

describe("hitung stok sebagai halaman", () => {
  it("daftar sesi menuju route detail, bukan drawer", () => {
    expect(list).toContain('router.push(`/app/inventori/opname/${id}`)');
    expect(list).not.toContain("<Drawer");
    expect(list).not.toContain("OpnameCountPanel");
  });

  it("halaman detail memuat sesi dan merender panel hitung", () => {
    expect(detail).toContain("getSession(id)");
    expect(detail).toContain("<OpnameCountClient");
    expect(detail).toContain("notFound()");
  });

  it("daftar sesi memakai tabs domain biasa", () => {
    expect(list).toContain("<TabsList>");
    expect(list).toContain('value="product"');
    expect(list).toContain('value="sparepart"');
  });

  it("filter dalam sesi memakai p-tabs-10 (Semua/Belum/Selisih) dan lebar menyesuaikan", () => {
    expect(panel).toContain("<PTabs10");
    expect(panel).toContain('value: "all", label: "Semua"');
    expect(panel).toContain('value: "pending", label: "Belum"');
    expect(panel).toContain('value: "diff", label: "Selisih"');
    expect(panel).not.toContain("ToggleGroup");
    const tabs = read("src/components/p-tabs-10.tsx");
    expect(tabs).toContain('<TabsList className="w-full">');
    expect(tabs).toContain("min-w-0 flex-1");
  });
});

describe("tampilan hitung stok", () => {
  it("memiliki search bar di atas daftar", () => {
    expect(panel).toContain('placeholder="Cari nama / SKU / IMEI"');
    expect(panel).toContain("setSearch(event.target.value)");
  });

  it("memakai progress bar selisih, bukan badge", () => {
    expect(panel).toContain("opnameVarianceBar");
    expect(panel).toContain('role="progressbar"');
    expect(panel).not.toContain("<Badge");
  });

  it("memiliki header tabel Items / Sistem / Fisik + kolom kosong di atas kartu", () => {
    expect(panel).toContain("<span>Items</span>");
    expect(panel).toContain(">Sistem</span>");
    expect(panel).toContain(">Fisik</span>");
    // Kolom ke-4 tanpa label: progress bar + tombol hitung berada di sana.
    expect(panel).toMatch(/Fisik<\/span>\s*<span \/>/);
  });

  it("baris atas: terhitung+progress di kiri, search+scan di kanan, search tidak full width", () => {
    expect(panel).toMatch(/w-56 shrink-0 items-center gap-3/);
    expect(panel).toContain('placeholder="Cari nama / SKU / IMEI"');
    expect(panel).toMatch(/relative w-56 shrink-0/);
    expect(panel).not.toContain("relative min-w-0 flex-1");
  });
});
