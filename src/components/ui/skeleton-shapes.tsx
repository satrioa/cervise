"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Bentuk skeleton yang mengikuti layout SETELAH render.
 *
 * `Skeleton` hanya alat isi: ia menggambar pola Dither di dalam kotak yang
 * diberikan pemanggil. Kalau pemanggil cuma memberi `h-40`, hasilnya persegi
 * panjang — bukan tabel, bukan daftar, bukan grafik. Karena itu bentuk di sini
 * disusun dari markup yang sama dengan versi nyata: `<tr>`/`<td>`, `<ul>`/`<li>`,
 * avatar, badge, progress bar, dan sumbu grafik.
 *
 * Aturan pakai:
 * - Header tabel, judul kartu, dan label statis TIDAK di-skeleton. Render
 *   teksnya apa adanya, lalu ganti hanya isi dinamis dengan primitive di sini.
 * - Untuk teks satu baris (jumlah, toolbar, placeholder inline), cukup pakai
 *   `Skeleton` biasa.
 * - Jangan memakai `rows` besar sebagai pengganti bentuk. Kalau blok itu akan
 *   menjadi tabel/daftar/grafik, pakai primitive yang sesuai.
 */

export type TableSkeletonCellKind =
  | "text"
  | "two-line"
  | "avatar"
  | "badge"
  | "money"
  | "progress"
  | "icon"
  | "empty";

export type TableSkeletonCell =
  | TableSkeletonCellKind
  | {
      kind: TableSkeletonCellKind;
      align?: "left" | "right";
      className?: string;
    };

/** Lebar pseudo-acak yang stabil supaya baris tidak terlihat seperti blok seragam. */
function barWidth(seed: number, min = 45, max = 90): number {
  return min + ((seed * 37) % (max - min + 1));
}

function CellShape({
  kind,
  row,
  column,
}: {
  kind: TableSkeletonCellKind;
  row: number;
  column: number;
}) {
  const seed = row * 7 + column * 13;

  switch (kind) {
    case "two-line":
      return (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3" style={{ width: `${barWidth(seed, 55, 80)}%` }} />
          <Skeleton className="h-2.5" style={{ width: `${barWidth(seed + 3, 35, 60)}%` }} />
        </div>
      );
    case "avatar":
      return (
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3" style={{ width: `${barWidth(seed, 55, 78)}%` }} />
            <Skeleton className="h-2.5" style={{ width: `${barWidth(seed + 5, 32, 58)}%` }} />
          </div>
        </div>
      );
    case "badge":
      return <Skeleton className="h-5 w-16 rounded-full" />;
    case "money":
      return <Skeleton className="ml-auto h-3" style={{ width: `${barWidth(seed, 55, 78)}%`, maxWidth: "5rem" }} />;
    case "progress":
      return (
        <div className="ml-auto flex w-28 items-center gap-2">
          <Skeleton className="h-1.5 flex-1 rounded-full" />
          <Skeleton className="h-2.5 w-8 shrink-0" />
        </div>
      );
    case "icon":
      return <Skeleton className="ml-auto size-6 rounded-full" />;
    case "empty":
      return null;
    default:
      return <Skeleton className="h-3" style={{ width: `${barWidth(seed)}%` }} />;
  }
}

/**
 * Baris isi tabel. Dipakai DI DALAM `<TableBody>` milik tabel asli supaya
 * kolom, border, dan padding tetap sama persis dengan hasil render.
 *
 * `rowClassName` dan `cellClassName` dipakai untuk tabel yang memakai markup
 * `<table>` biasa (bukan komponen `Table`), supaya padding baris skeleton
 * sama persis dengan baris datanya.
 *
 * ```tsx
 * <TableBody>
 *   {loading ? <TableRowsSkeleton cells={["text", "avatar", "badge", "money", "icon"]} /> : rows.map(...)}
 * </TableBody>
 * ```
 */
export function TableRowsSkeleton({
  cells,
  rows = 5,
  className,
  rowClassName,
  cellClassName,
}: {
  cells: TableSkeletonCell[];
  rows?: number;
  className?: string;
  rowClassName?: string;
  cellClassName?: string;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={row} className={cn(className, rowClassName)} aria-hidden>
          {cells.map((cell, column) => {
            const spec = typeof cell === "string" ? { kind: cell } : cell;
            const align =
              spec.align ??
              (spec.kind === "money" || spec.kind === "icon" || spec.kind === "progress"
                ? "right"
                : "left");
            return (
              <TableCell
                key={column}
                className={cn(cellClassName, align === "right" && "text-right", spec.className)}
              >
                <CellShape kind={spec.kind} row={row} column={column} />
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </>
  );
}

/**
 * Baris isi tabel yang memakai markup `<table>` biasa, bukan komponen
 * `Table`. Dipakai di tabel yang wrote `<td className="px-3 py-2">` sendiri,
 * supaya padding baris skeleton sama persis dengan baris datanya.
 */
export function PlainTableRowsSkeleton({
  cells,
  rows = 5,
  cellClassName,
  rowClassName,
}: {
  cells: TableSkeletonCell[];
  rows?: number;
  cellClassName?: string;
  rowClassName?: string;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} className={rowClassName} aria-hidden>
          {cells.map((cell, column) => {
            const spec = typeof cell === "string" ? { kind: cell } : cell;
            const align =
              spec.align ??
              (spec.kind === "money" || spec.kind === "icon" || spec.kind === "progress"
                ? "right"
                : "left");
            return (
              <td
                key={column}
                className={cn(
                  cellClassName,
                  align === "right" && "text-right",
                  spec.className,
                )}
              >
                <CellShape kind={spec.kind} row={row} column={column} />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

export type ListSkeletonLeading = "avatar" | "icon" | "checkbox" | "initial" | "none";
export type ListSkeletonTrailing = "value" | "badge" | "actions" | "none";

function LeadingShape({ leading }: { leading: ListSkeletonLeading }) {
  switch (leading) {
    case "avatar":
      return <Skeleton className="size-9 shrink-0 rounded-full" />;
    case "icon":
      return <Skeleton className="size-7 shrink-0 rounded-full" />;
    case "checkbox":
      return <Skeleton className="size-5 shrink-0 rounded-full" />;
    case "initial":
      return <Skeleton className="size-6 shrink-0 rounded-full" />;
    default:
      return null;
  }
}

function TrailingShape({ trailing }: { trailing: ListSkeletonTrailing }) {
  switch (trailing) {
    case "value":
      return <Skeleton className="h-3 w-14 shrink-0" />;
    case "badge":
      return <Skeleton className="h-5 w-16 shrink-0 rounded-full" />;
    case "actions":
      return (
        <span className="flex shrink-0 items-center gap-1">
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="size-5 rounded-full" />
        </span>
      );
    default:
      return null;
  }
}

/**
 * Daftar baris dengan leading (avatar/ikon/centang), 1–2 baris teks, dan
 * trailing (nominal/badge/aksi). `divided` meniru `divide-y` pada daftar nyata.
 */
export function ListRowsSkeleton({
  rows = 3,
  leading = "avatar",
  lines = 2,
  trailing = "none",
  divided = false,
  className,
  itemClassName,
}: {
  rows?: number;
  leading?: ListSkeletonLeading;
  lines?: 1 | 2;
  trailing?: ListSkeletonTrailing;
  divided?: boolean;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <ul
      aria-hidden
      className={cn(
        "flex flex-col",
        divided ? "divide-y divide-black/5 dark:divide-white/10" : "gap-3",
        className,
      )}
    >
      {Array.from({ length: rows }, (_, row) => (
        <li
          key={row}
          className={cn("flex items-center gap-2", divided && "py-2", itemClassName)}
        >
          <LeadingShape leading={leading} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {Array.from({ length: lines }, (_, line) => (
              <Skeleton
                key={line}
                className={line === 0 ? "h-3" : "h-2.5"}
                style={{
                  width: `${barWidth(row * 3 + line * 11, 40, line === 0 ? 85 : 62)}%`,
                }}
              />
            ))}
          </div>
          <TrailingShape trailing={trailing} />
        </li>
      ))}
    </ul>
  );
}

/** Bar nilai besar untuk kartu statistik. Label kartu tetap dirender asli. */
export function StatValueSkeleton({
  className,
  valueClassName,
  progress = false,
}: {
  className?: string;
  valueClassName?: string;
  progress?: boolean;
}) {
  return (
    <div aria-hidden className={cn("space-y-2", className)}>
      <Skeleton className={cn("h-7 w-24", valueClassName)} />
      {progress ? <Skeleton className="h-2 w-full rounded-full" /> : null}
    </div>
  );
}

const AREA_SHAPES = {
  naik: "polygon(0% 78%, 8% 70%, 18% 74%, 28% 58%, 38% 62%, 48% 44%, 58% 50%, 68% 32%, 78% 38%, 88% 20%, 100% 26%, 100% 100%, 0% 100%)",
  turun: "polygon(0% 26%, 8% 34%, 18% 28%, 28% 48%, 38% 42%, 48% 60%, 58% 54%, 68% 72%, 78% 66%, 88% 82%, 100% 76%, 100% 100%, 0% 100%)",
  datar: "polygon(0% 54%, 8% 48%, 18% 56%, 28% 50%, 38% 58%, 48% 46%, 58% 54%, 68% 50%, 78% 56%, 88% 48%, 100% 52%, 100% 100%, 0% 100%)",
} as const;

export type ChartSkeletonShape = keyof typeof AREA_SHAPES;

function ChartArea({ shape }: { shape: ChartSkeletonShape }) {
  return (
    <div className="absolute inset-0" style={{ clipPath: AREA_SHAPES[shape] }}>
      <Skeleton rows={20} className="h-full w-full rounded-none text-[7px]" />
    </div>
  );
}

/**
 * Kerangka grafik: sumbu, garis grid, label, dan siluet area. Bukan blok penuh.
 * `sparkline` hanya siluet karena grafik aslinya juga tanpa sumbu.
 */
export function ChartSkeleton({
  variant = "line",
  shape = "naik",
  className,
}: {
  variant?: "line" | "sparkline";
  shape?: ChartSkeletonShape;
  className?: string;
}) {
  if (variant === "sparkline") {
    return (
      <div aria-hidden className={cn("relative h-full w-full", className)}>
        <ChartArea shape={shape} />
      </div>
    );
  }

  return (
    <div aria-hidden className={cn("relative h-full w-full pb-5 pl-9", className)}>
      {/* grid horizontal */}
      <div className="absolute top-1 right-0 bottom-5 left-9 flex flex-col justify-between">
        {[0, 1, 2, 3].map((line) => (
          <div key={line} className="border-t border-border/40" />
        ))}
      </div>

      {/* label sumbu Y */}
      <div className="absolute top-1 bottom-5 left-0 flex w-7 flex-col justify-between">
        {[0, 1, 2, 3, 4].map((line) => (
          <Skeleton
            key={line}
            className="h-2"
            style={{ width: `${45 + ((line * 17) % 40)}%` }}
          />
        ))}
      </div>

      {/* area plot */}
      <div className="absolute top-1 right-0 bottom-5 left-9">
        <ChartArea shape={shape} />
      </div>

      {/* label sumbu X */}
      <div className="absolute right-0 bottom-0 left-9 flex justify-between">
        {[0, 1, 2, 3, 4, 5].map((tick) => (
          <Skeleton
            key={tick}
            className="h-2"
            style={{ width: `${8 + ((tick * 7) % 6)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Kerangka timeline: titik, garis penghubung, dua baris teks, dan waktu. */
export function TimelineSkeleton({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("space-y-4", className)}>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-3">
          <div className="flex flex-col items-center">
            <Skeleton className="size-2.5 shrink-0 rounded-full" />
            {row < rows - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
          </div>
          <div className="flex-1 space-y-1.5 pb-1">
            <Skeleton className="h-3" style={{ width: `${barWidth(row + 2, 45, 65)}%` }} />
            <Skeleton className="h-2.5" style={{ width: `${barWidth(row + 8, 30, 55)}%` }} />
            <Skeleton className="h-2 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
