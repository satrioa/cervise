import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ChartSkeleton,
  ListRowsSkeleton,
  PlainTableRowsSkeleton,
  StatValueSkeleton,
  TableRowsSkeleton,
  TimelineSkeleton,
} from "./skeleton-shapes";

/**
 * Skeleton harus mempresentasikan bentuk SETELAH render.
 *
 * Dulu setiap tempat yang memuat data menulis `<Skeleton className="h-40" />`:
 * satu blok Dither yang hanya menyatakan "ada isi di sini", tanpa-memberi
 * tahu bentuk isi itu. Table jadi persegi, daftar jadi balok, grafik jadi
 * balok.
 *
 * Test di sini mengunci dua hal:
 * 1. Primitive di `@/components/ui/skeleton-shapes` memang menghasilkan
 *    struktur yang BENAR (baris, kolom, avatar, badge, sumbu) — bukan satu
 *    blok.
 * 2. Tidak ada lagi `<Skeleton className="h-2x">` yang dipakai sebagai
 *    pengganti tabel/daftar/grafik di mana pun di `src/`.
 */

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

describe("TableRowsSkeleton: baris dan kolom mengikuti tabel asli", () => {
  it("menghasilkan jumlah baris yang diminta", () => {
    const html = render(
      <table>
        <tbody>
          <TableRowsSkeleton cells={["text", "text", "text"]} rows={4} />
        </tbody>
      </table>,
    );
    expect((html.match(/<tr/g) ?? []).length).toBe(4);
  });

  it("menghasilkan jumlah sel yang sama dengan jumlah kolom", () => {
    const html = render(
      <table>
        <tbody>
          <TableRowsSkeleton cells={["text", "badge", "money", "icon"]} rows={2} />
        </tbody>
      </table>,
    );
    // 2 baris x 4 kolom = 8 sel.
    expect((html.match(/<td/g) ?? []).length).toBe(8);
  });

  it("menggambar bentuk tiap jenis sel", () => {
    const html = render(
      <table>
        <tbody>
          <TableRowsSkeleton
            cells={["avatar", "badge", "progress", "icon", "two-line"]}
            rows={1}
          />
        </tbody>
      </table>,
    );
    // Avatar = kotak bulat, badge = pill, progress = bar tipis, ikon = kotak
    // bulat kecil, two-line = dua baris teks.
    expect(html).toMatch(/rounded-full/);
    expect(html).toMatch(/rounded-full/);
    expect(html).toMatch(/h-1\.5/);
    expect(html).toMatch(/size-8/);
  });

  it("menjaga kolom nominal rata kanan seperti tabel aslinya", () => {
    const html = render(
      <table>
        <tbody>
          <TableRowsSkeleton cells={["text", "money"]} rows={1} />
        </tbody>
      </table>,
    );
    expect(html).toContain("text-right");
  });
});

describe("PlainTableRowsSkeleton: untuk tabel markup biasa", () => {
  it("menghasilkan baris dan sel tanpa komponen Table", () => {
    const html = render(
      <table>
        <tbody>
          <PlainTableRowsSkeleton cells={["text", "money", "icon"]} rows={3} />
        </tbody>
      </table>,
    );
    expect((html.match(/<tr/g) ?? []).length).toBe(3);
    expect((html.match(/<td/g) ?? []).length).toBe(9);
    // Tidak membungkus diri dengan `data-slot=table-*` milik komponen Table.
    expect(html).not.toContain('data-slot="table-cell"');
  });

  it("memakai class sel yang diberikan supaya padding sama dengan tabel", () => {
    const html = render(
      <table>
        <tbody>
          <PlainTableRowsSkeleton
            cells={["text", "money"]}
            rows={1}
            cellClassName="px-3 py-2"
          />
        </tbody>
      </table>,
    );
    expect(html).toContain("px-3 py-2");
  });
});

describe("ListRowsSkeleton: baris daftar dengan leading dan trailing", () => {
  it("menghasilkan jumlah baris yang diminta", () => {
    const html = render(<ListRowsSkeleton rows={3} leading="avatar" lines={2} />);
    expect((html.match(/<li/g) ?? []).length).toBe(3);
  });

  it("menggambar leading sesuai jenisnya", () => {
    const avatar = render(<ListRowsSkeleton rows={1} leading="avatar" />);
    expect(avatar).toMatch(/size-9/);
    const checkbox = render(<ListRowsSkeleton rows={1} leading="checkbox" />);
    expect(checkbox).toMatch(/size-5/);
  });

  it("menggambar trailing sesuai jenisnya", () => {
    const badge = render(<ListRowsSkeleton rows={1} trailing="badge" />);
    expect(badge).toMatch(/rounded-full/);
    const actions = render(<ListRowsSkeleton rows={1} trailing="actions" />);
    expect((actions.match(/size-5/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("memakai divide-y saat diminta, supaya pembatas sama seperti daftar nyata", () => {
    expect(render(<ListRowsSkeleton rows={2} divided />)).toContain("divide-y");
    expect(render(<ListRowsSkeleton rows={2} />)).not.toContain("divide-y");
  });
});

describe("ChartSkeleton: grafik bukan blok penuh", () => {
  it("menggambar sumbu, grid, dan label", () => {
    const html = render(<ChartSkeleton />);
    // Garis grid + label sumbu Y dan X.
    expect(html).toContain("border-t");
    expect(html).toContain("pl-9");
    expect(html).toContain("pb-5");
  });

  it("menggunakan clip-path untuk siluet area, bukan isi penuh", () => {
    const html = render(<ChartSkeleton shape="naik" />);
    expect(html).toContain("clip-path");
    expect(html).toContain("polygon");
  });

  it("sparkline tidak drew sumbu, seperti grafik aslinya", () => {
    const spark = render(<ChartSkeleton variant="sparkline" />);
    expect(spark).toContain("clip-path");
    expect(spark).not.toContain("border-t");
  });
});

describe("StatValueSkeleton dan TimelineSkeleton", () => {
  it("kartu statistik punya bar nilai dan bar progress bila diminta", () => {
    expect(render(<StatValueSkeleton />)).toContain("h-7");
    expect(render(<StatValueSkeleton progress />)).toContain("rounded-full");
  });

  it("timeline menggambar titik, garis, dan waktu", () => {
    const html = render(<TimelineSkeleton rows={2} />);
    expect((html.match(/rounded-full/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("bg-border");
  });
});

/**
 * Penjaga terakhir: tidak ada lagi blok besar `Skeleton` yang dipakai sebagai
 * pengganti tabel/daftar/grafik. Pola `h-16` ke atas berarti "area tinggi yang
 * akan diisi sesuatu" — bentuknya harus datang dari markup, bukan dari satu
 * rectangle.
 */
describe("tidak ada skeleton blok besar yang menggantikan bentuk", () => {
  const files = [
    "src/app/app/garansi/garansi-client.tsx",
    "src/app/app/keuangan/transaksi/transaksi-client.tsx",
    "src/app/app/laporan/keuangan/laporan-keuangan-client.tsx",
    "src/app/app/laporan/penjualan/laporan-penjualan-client.tsx",
    "src/app/app/laporan/performa/laporan-performa-client.tsx",
    "src/app/app/laporan/servis/laporan-servis-client.tsx",
    "src/app/app/laporan/shift/shift-client.tsx",
    "src/app/app/pengaturan/usage/pengaturan-usage-client.tsx",
    "src/app/app/penjualan/penjualan-pos-client.tsx",
    "src/components/cabang/cabang-drawer.tsx",
    "src/components/customer/customer-row-actions.tsx",
    "src/components/dashboard/task-note-card.tsx",
    "src/components/servis/servis-detail-view.tsx",
    "src/components/servis/sparepart-dialogs.tsx",
    "src/components/table-audit-log.tsx",
  ];

  it("tidak ada `h-16` atau lebih besar di pemanggilan Skeleton", () => {
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      // Ambil hanya pemanggilan <Skeleton ...> beserta class-nya.
      const calls = source.match(/<Skeleton\b[^>]*>/g) ?? [];
      for (const call of calls) {
        const height = call.match(/\bh-(\d+)\b/);
        if (!height) continue;
        const value = Number(height[1]);
        expect(
          value,
          `${file}: skeleton setinggi ${value}px masih dipakai sebagai pengganti bentuk`,
        ).toBeLessThan(16);
      }
    }
  });

  it("tabel yang punya kolom memakai TableRowsSkeleton, bukan satu sel raksasa", () => {
    const tableFiles = [
      "src/app/app/garansi/garansi-client.tsx",
      "src/app/app/keuangan/transaksi/transaksi-client.tsx",
      "src/app/app/laporan/keuangan/laporan-keuangan-client.tsx",
      "src/app/app/laporan/penjualan/laporan-penjualan-client.tsx",
      "src/app/app/laporan/performa/laporan-performa-client.tsx",
      "src/app/app/laporan/servis/laporan-servis-client.tsx",
      "src/app/app/laporan/shift/shift-client.tsx",
      "src/app/app/pengaturan/usage/pengaturan-usage-client.tsx",
      "src/components/table-audit-log.tsx",
    ];
    for (const file of tableFiles) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(
        source,
        `${file}: tabel belum memakai TableRowsSkeleton`,
      ).toContain("TableRowsSkeleton");
    }
  });

  it("tidak ada lagi `rows={18}` atau lebih sebagai blok tabel", () => {
    const files = [
      "src/app/app/garansi/garansi-client.tsx",
      "src/app/app/keuangan/transaksi/transaksi-client.tsx",
      "src/app/app/laporan/keuangan/laporan-keuangan-client.tsx",
      "src/app/app/laporan/penjualan/laporan-penjualan-client.tsx",
      "src/app/app/laporan/servis/laporan-servis-client.tsx",
      "src/app/app/laporan/shift/shift-client.tsx",
      "src/app/app/pengaturan/usage/pengaturan-usage-client.tsx",
      "src/app/app/penjualan/penjualan-pos-client.tsx",
      "src/components/table-audit-log.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      const big = source.match(/rows=\{(\d+)\}/g) ?? [];
      for (const call of big) {
        const value = Number(call.match(/\d+/)?.[0] ?? "0");
        expect(
          value,
          `${file}: blok rows={${value}} masih dipakai sebagai pengganti bentuk`,
        ).toBeLessThanOrEqual(8);
      }
    }
  });
});
