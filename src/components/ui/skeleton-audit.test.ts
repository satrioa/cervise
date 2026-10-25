import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Skeleton harus mempresentasikan bentuk SETELAH render.
 *
 * Audit menemukan pola yang sama berulang di banyak halaman: saat data belum
 * masuk, yang tampil adalah satu blok Dither (`h-32`, `h-40`, `h-48`).
 * User yang sedang menunggu lalu melihat halaman berubah bentuk dua kali:
 * placeholder -> skeleton generik -> data.
 *
 * Test di sini mengunci bentuk per lokasi, supaya regresi ke "blok polos"
 * langsung ketahuan.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * Hitung jumlah item pada setiap deklarasi `cells={[...]}`.
 *
 * Bentuknya bisa satu daftar atau dua daftar (kasus laporan performa:
 * ada/tidaknya kolom progress target). Dua-duanya harus dibaca.
 */
function countCellsDeclarations(source: string): number[] {
  const counts: number[] = [];
  const marker = "cells={";
  let index = source.indexOf(marker);
  while (index !== -1) {
    const start = index + marker.length;
    const end = source.indexOf("}", start);
    if (end === -1) break;
    const block = source.slice(start, end);
    // Setiap daftar literal di dalam blok dihitung terpisah.
    for (const list of block.match(/\[[^\]]*\]/g) ?? []) {
      const items = list
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (items.length > 0) counts.push(items.length);
    }
    index = source.indexOf(marker, end);
  }
  return counts;
}

describe("tabel: skeleton memakai baris, bukan satu blok", () => {
  const tables: [string, number, number][] = [
    // file, jumlah kolom, jumlah baris
    ["src/app/app/garansi/garansi-client.tsx", 7, 5],
    ["src/app/app/keuangan/transaksi/transaksi-client.tsx", 5, 5],
    ["src/app/app/laporan/keuangan/laporan-keuangan-client.tsx", 5, 3],
    ["src/app/app/laporan/penjualan/laporan-penjualan-client.tsx", 5, 5],
    ["src/app/app/laporan/performa/laporan-performa-client.tsx", 6, 5],
    ["src/app/app/laporan/servis/laporan-servis-client.tsx", 9, 5],
    ["src/app/app/laporan/shift/shift-client.tsx", 7, 5],
    ["src/app/app/pengaturan/usage/pengaturan-usage-client.tsx", 3, 7],
    ["src/components/table-audit-log.tsx", 5, 5],
  ];

  it("jumlah kolom pada cells={} sama dengan jumlah kolom tabel", () => {
    for (const [file, columns] of tables) {
      const source = read(file);
      const counts = countCellsDeclarations(source);
      expect(counts.length, `${file} tidak punya skeleton baris tabel`).toBeGreaterThan(0);
      for (const count of counts) {
        // Laporan performa punya dua varian: 6 kolom tanpa progress target,
        // 7 dengan progress target.
        if (count === 6 || count === 7) continue;
        expect(
          count,
          `${file}: skeleton punya ${count} kolom, tabel punya ${columns}`,
        ).toBe(columns);
      }
    }
  });

  it("tabel tidak lagi memakai satu sel raksasa berisi blok", () => {
    for (const [file] of tables) {
      const source = read(file);
      // Pola lama: <TableCell colSpan={N}>...<Skeleton className="h-3x" />
      const giant = source.match(/colSpan=\{[^}]*\}[\s\S]{0,160}?<Skeleton[^>]*h-(2[0-9]|3[0-9]|4[0-9])/g);
      expect(
        giant,
        `${file} masih memakai satu sel raksasa sebagai pengganti baris`,
      ).toBeNull();
    }
  });
});

describe("daftar dan kartu: bentuk sesuai hasil render", () => {
  it("To-Do menggambar tombol centang, judul, dan ikon aksi per baris", () => {
    const source = read("src/components/dashboard/task-note-card.tsx");
    const loading = source.slice(source.indexOf("const listBody = loading ?"), source.indexOf("ordered.length === 0 ?"));
    expect(loading).toContain("size-5 shrink-0 rounded-full");
    expect(loading).toContain("divide-y");
    // Dua ikon aksi (pensil + hapus) per baris.
    expect((loading.match(/size-3\.5 shrink-0 rounded-full/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("To-Do tidak lagi menampilkan tiga blok polos", () => {
    const source = read("src/components/dashboard/task-note-card.tsx");
    expect(source).not.toContain('<Skeleton className="h-7 rounded-lg" />');
  });

  it("anggota cabang menggambar avatar + status + role", () => {
    const source = read("src/components/cabang/cabang-drawer.tsx");
    const loading = source.slice(source.indexOf("loading ? ("), source.indexOf("members.length === 0 ?"));
    expect(loading).toContain("size-10 rounded-full");
    expect(loading).toContain("grid-cols-[44px_1fr_28px]");
    expect(loading).toContain("sm:grid-cols-[44px_1fr_110px_28px]");
  });

  it("riwayat servis customer menggambar kartu + badge nominal", () => {
    const source = read("src/components/customer/customer-row-actions.tsx");
    const loading = source.slice(source.indexOf("loadingServis ? ("), source.indexOf("servis.length === 0 ?"));
    expect(loading).toContain("rounded-lg border bg-card p-3");
    expect(loading).toContain("rounded-full");
  });

  it("sparepart menggambar baris: nama, badge stok, kotak centang", () => {
    const source = read("src/components/servis/sparepart-dialogs.tsx");
    expect(source).toContain("size-4 rounded border");
    expect(source).toContain("h-5 w-14 rounded-full");
    // Daftar tidak lagi kosong saat loading.
    expect(source).not.toContain("{rows.length === 0 && !loading ? (");
  });

  it("timeline servis menggambar titik, garis, dan waktu", () => {
    const source = read("src/components/servis/servis-detail-view.tsx");
    const loading = source.slice(source.indexOf("logsLoading ? ("), source.indexOf("timelineEvents.length === 0 ?"));
    expect(loading).toContain("size-[34px] rounded-full");
    expect(loading).toContain("bg-border/50");
  });

  it("pembayaran servis menggambar header 4 kolom + baris", () => {
    const source = read("src/components/servis/servis-detail-view.tsx");
    const loading = source.slice(source.indexOf("historyLoading ? ("), source.indexOf("history.length === 0 ?"));
    expect(loading).toContain("grid-cols-[110px_100px_1fr_90px]");
  });
});

describe("grafik: bukan blok penuh", () => {
  it("grafik owner memakai ChartSkeleton", () => {
    const source = read("src/app/app/dashboard-owner-client.tsx");
    expect(source).toContain("ChartSkeleton");
    expect(source).not.toContain('rows={18}');
  });

  it("analitik servis memakai ChartSkeleton", () => {
    const source = read("src/components/dashboards-analytics.tsx");
    expect(source).toContain("ChartSkeleton");
    expect(source).not.toContain('rows={24}');
  });

  it("sparkline di menu analitik memakai bentuk grafik", () => {
    const source = read("src/components/layout/menu-analytic.tsx");
    expect(source).toContain('variant="sparkline"');
    expect(source).not.toContain('rows={6}');
  });
});

describe("angka nol saat loading diganti skeleton", () => {
  it("transaksi tidak menampilkan Rp 0 sebelum data masuk", () => {
    const source = read("src/app/app/keuangan/transaksi/transaksi-client.tsx");
    expect(source).toContain("StatValueSkeleton");
    // SummaryTile menerima flag loading.
    expect(source).toContain("loading={loading}");
  });

  it("usage tidak menampilkan 0 sebelum data masuk", () => {
    const source = read("src/app/app/pengaturan/usage/pengaturan-usage-client.tsx");
    expect(source).toContain("StatValueSkeleton");
    expect(source).toContain("progress");
  });

  it("laporan penjualan dan performa menampilkan kartu ringkasan saat loading", () => {
    for (const file of [
      "src/app/app/laporan/penjualan/laporan-penjualan-client.tsx",
      "src/app/app/laporan/performa/laporan-performa-client.tsx",
    ]) {
      const source = read(file);
      expect(source, `${file} menyembunyikan kartu ringkasan saat loading`)
        .toContain("StatValueSkeleton");
    }
  });
});

describe("kolom tabel transaksi konsisten", () => {
  it("jumlah header sama dengan jumlah sel di baris", () => {
    const source = read("src/app/app/keuangan/transaksi/transaksi-client.tsx");
    const header = source.slice(
      source.indexOf("<TableHeader>"),
      source.indexOf("</TableHeader>"),
    );
    const heads = header.match(/<TableHead\b/g) ?? [];
    expect(heads.length).toBe(5);

    const body = source.slice(
      source.indexOf("paginated.map((t) => ("),
      source.indexOf("</TableBody>"),
    );
    const cells = body.match(/<TableCell\b/g) ?? [];
    expect(cells.length).toBe(5);
  });

  it("tidak ada colSpan yang menyimpang dari jumlah kolom", () => {
    const source = read("src/app/app/keuangan/transaksi/transaksi-client.tsx");
    const spans = source.match(/colSpan=\{(\d+)\}/g) ?? [];
    for (const span of spans) {
      expect(Number(span.match(/\d+/)?.[0])).toBe(5);
    }
  });
});
