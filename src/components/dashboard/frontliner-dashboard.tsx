"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  LockIcon,
  ShoppingCartIcon,
  WalletIcon,
  WrenchIcon,
} from "lucide-react";
import { motion } from "motion/react";
import {
  BENTO_GRID_CLASS,
  BentoCard,
  BentoMenuItem,
  useBentoStagger,
} from "./bento-card";
import { CandyButton } from "@/components/ui/candy-button";
import { Skeleton } from "@/components/ui/skeleton";
import { AsciiReveal } from "@/components/ui/ascii";
import { TaskNoteCard } from "./task-note-card";
import { AdjustmentDialog } from "@/components/cash/adjustment-dialog";
import { ClosingDialog } from "@/components/cash/closing-dialog";
import {
  checkOpenCashSession,
  getFrontlinerKpi,
  getFrontlinerQueue,
  getShiftPreview,
  type CashSessionRow,
  type FrontlinerKpi,
  type FrontlinerQueueItem,
} from "@/app/app/actions/cash";
import { rupiah, type ShiftReport } from "@/lib/operational/laporan-shift";
import { cn } from "@/lib/utils";

/**
 * Jarak antar kartu, dalam detik.
 *
 * 0.04 untuk 8 kartu. Lebih kecil dari dashboard teknisi (0.05 untuk 7
 * kartu) karena dua kartu di sini membentang dua dan tiga baris sehingga
 * gerakannya lebih lama terlihat, dan 8 x 0.05 sudah 400ms.
 */
const BENTO_STAGGER = 0.04;

/**
 * Dashboard frontliner.
 *
 * Delapan sel, mengikuti konsep Figma. Urutan sel di bawah menentukan posisi
 * karena CSS grid menumpuk otomatis:
 *
 *     ┌────────┬────────┬──────────┬────────────┐
 *     │ Servis │ Catat  │ Ringkasan│            │
 *     │ baru   │ Kas    │ Hari ini │  Servis    │
 *     ├────────┼────────┤  (3 baris)│  terbaru   │
 *     │Penjualan│Ringkasan│          │  (2 baris) │
 *     │        │ Servis ├──────────┼────────────┤
 *     ├────────┴────────┤          │   TODAY    │
 *     │Servis Selesai   │          │            │
 *     │Belum dibayar    │          │            │
 *     └──────────────────┴──────────┴────────────┘
 *
 * Pembayaran tidak ada di sini. Baris "Servis terbaru" dan "Servis Selesai
 * Belum dibayar" membuka `/app/servis/{id}`, dan pembayaran dilakukan di
 * halaman detail servis.
 */

export function FrontlinerDashboard({ fullName }: { fullName: string | null }) {
  const { gridProps } = useBentoStagger(BENTO_STAGGER);

  const [queue, setQueue] = useState<FrontlinerQueueItem[]>([]);
  const [kpi, setKpi] = useState<FrontlinerKpi | null>(null);
  const [session, setSession] = useState<CashSessionRow | null>(null);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [closingOpen, setClosingOpen] = useState(false);
  /**
   * True hanya sampai data pertama tiba. Refresh berikutnya (mis. setelah
   * mencatat kas) tidak menyalakannya lagi, supaya angka yang sudah tampil
   * tidak berkedip kembali menjadi skeleton.
   */
  const [loading, setLoading] = useState(true);

  /**
   * Semua data dashboard diambil lewat satu fungsi.
   *
   * Laporan shift WAJIB ikut di sini, bukan hanya saat mount. Sebelumnya
   * `getShiftPreview` hanya dipanggil sekali, jadi begitu kasir membayar
   * servis atau mencatat kas, angka "Harus ada di laci" di Ringkasan Hari
   * ini tetap memakai nilai lama sampai halaman di-reload - terlihat seperti
   * datanya hardcoded padahal tidak.
   *
   * Ketiga query pertama berjalan paralel, lalu preview menyusul karena
   * butuh id sesi. `finally` mematikan skeleton setelah SEMUA data siap,
   * bukan setelah salah satu selesai - kalau tidak, kartu antrean sempat
   * berkedip "Belum ada servis" padahal datanya masih di jalan.
   */
  const reload = useCallback(async () => {
    try {
      const [queueResult, kpiResult, sessionResult] = await Promise.all([
        getFrontlinerQueue(),
        getFrontlinerKpi(),
        checkOpenCashSession(),
      ]);

      if (queueResult.ok) setQueue(queueResult.data);
      if (kpiResult.ok) setKpi(kpiResult.data);
      if (!sessionResult.ok) return;

      setSession(sessionResult.data.current);
      if (!sessionResult.data.current) {
        setReport(null);
        return;
      }

      const preview = await getShiftPreview(sessionResult.data.current.id);
      if (preview.ok) setReport(preview.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    // Latar halaman memakai kanvas shell; kartu mengikuti tinggi isinya.
    <div className="min-h-full bg-canvas text-foreground">
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mx-auto w-full max-w-[1264px]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </div>
              <h1 className="mt-1 font-heading text-[2rem] font-normal leading-tight tracking-[-0.03em] sm:text-[2.5rem]">
                {greeting()}, {fullName ?? "Frontliner"}.
              </h1>
            </div>
            <CandyButton
              tone="accent-amber"
              onClick={() => setClosingOpen(true)}
              disabled={!session}
              className="rounded-full px-4 py-2 text-xs"
            >
              <LockIcon className="size-4" />
              Tutup Toko
            </CandyButton>
          </div>

          {/* Kartu TIDAK memasang `initial`/`animate` sendiri; itu syarat agar
              `staggerChildren` benar-benar sampai ke tiap kartu. */}
          {/* Data dashboard datang dari klien: saat `loading` selesai, isi grid
              decode masuk dengan preset Blueprint. `revealOnMount={false}`
              supaya tidak menumpuk dengan reveal halaman dari shell. */}
          <AsciiReveal loading={loading} shimmer={false} revealOnMount={false}>
            <motion.div {...gridProps} className={BENTO_GRID_CLASS}>
              {/* 1. Kartu aksi - permukaannya sendiri yang candy. */}
              <BentoCard candy="accent" href="/app/servis/baru" title="Servis baru">
                <BentoMenuItem icon={WrenchIcon} label="Servis baru" />
              </BentoCard>

              {/* 2. Kartu aksi. Satu-satunya sel aksi yang bukan tautan -
                  "Catat Kas" membuka dialog. */}
              <BentoCard candy="amber" onClick={() => setAdjustOpen(true)} title="Catat Kas">
                <BentoMenuItem icon={WalletIcon} label="Catat Kas" />
              </BentoCard>

              {/* 3. Rekap kas hari ini, tiga baris. Di mobile menjadi kartu
                  selebar dua kolom. */}
              <BentoCard rowSpan={3} className="max-sm:col-span-2">
                <RingkasanHariIni report={report} queue={queue} loading={loading} />
              </BentoCard>

              {/* 4. Daftar servis terbaru, dua baris. Putih di mobile seperti
                  frame Figma. */}
              <BentoCard
                rowSpan={2}
                className="max-sm:col-span-2 max-sm:bg-white max-sm:hover:bg-white max-sm:dark:bg-neutral-800 max-sm:dark:hover:bg-neutral-800"
              >
                <h2 className="text-[15px] font-medium tracking-tight">Servis terbaru</h2>
                <TerbaruList queue={queue} loading={loading} />
              </BentoCard>

              {/* 5. Kartu aksi. */}
              <BentoCard candy="green" href="/app/penjualan" title="Penjualan">
                <BentoMenuItem icon={ShoppingCartIcon} label="Penjualan" />
              </BentoCard>

              {/* 6. Tiga angka servis, satu kolom. */}
              <BentoCard>
                <RingkasanServis kpi={kpi} />
              </BentoCard>

              {/* 7. Servis selesai yang belum dibayar, melebar dua kolom.
                  Tanpa `hug`: kartu mengisi sel bento dan daftarnya menggulir
                  di dalam, jadi tingginya selalu sama dengan kartu tetangga. */}
              <BentoCard span={2} className="max-sm:col-span-2">
                <ServisSelesaiBelumDibayar queue={queue} loading={loading} />
              </BentoCard>

              {/* 8. To-Do, satu sel di desktop; di mobile selebar dua kolom. */}
              <BentoCard className="max-sm:col-span-2">
                <TaskNoteCard variant="compact" compact compactLimit={1} />
              </BentoCard>
            </motion.div>
          </AsciiReveal>
        </div>
      </div>

      <AdjustmentDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        onSaved={() => void reload()}
      />
      <ClosingDialog
        open={closingOpen}
        onOpenChange={setClosingOpen}
        session={session}
        onClosed={() => void reload()}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Isi sel
// ---------------------------------------------------------------------------

/**
 * "Ringkasan Hari ini": saldo awal, servis, penjualan, transaksi kas, lalu
 *_expected cash_ yang harus ada di laci. Semuanya dari `ShiftReport` - tidak
 * ada query tambahan.
 */
function RingkasanHariIni({
  report,
  queue,
  loading,
}: {
  report: ShiftReport | null;
  queue: FrontlinerQueueItem[];
  loading: boolean;
}) {
  // Skeleton hanya saat data pertama belum tiba. Tanpa cabang ini, kartu
  // sempat menampilkan "Belum ada sesi kas terbuka" padahal sesinya ada dan
  // laporan shift-nya masih diambil.
  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-busy="true">
        <h2 className="shrink-0 text-[15px] font-medium tracking-tight">Ringkasan Hari ini</h2>
        <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5" aria-hidden>
          <Skeleton className="h-6 w-full rounded-lg" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-full rounded-lg" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-full rounded-lg" />
        </div>
        {/* Blok total tetap di dasar kartu, sama seperti posisi aslinya. */}
        <div className="mt-2 flex shrink-0 flex-col gap-1.5" aria-hidden>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-5 w-full rounded-md" />
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <>
        <h2 className="shrink-0 text-[15px] font-medium tracking-tight">Ringkasan Hari ini</h2>
        <p className="mt-2 text-sm opacity-60">
          Belum ada sesi kas terbuka. Buka kas untuk melihat rekap.
        </p>
      </>
    );
  }

  const layananTerbayar = report.services.filter((line) => line.counted);
  const produkTerbayar = report.sales.filter((line) => line.settled);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <h2 className="shrink-0 text-[15px] font-medium tracking-tight">Ringkasan Hari ini</h2>

      {/* Hanya daftar ini yang menggulir. Blok total di bawah sengaja berada
          di luar `<ul>` supaya tetap terlihat saat daftar transaksi panjang. */}
      <ul className="-mx-1 mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto scrollbar-none text-[13px]">
        <Row label="Saldo Awal" value={rupiah(report.openingBalance)} boxed />

        <GroupLabel
          label="Servis"
          count={report.services.length}
          items={layananTerbayar.map((line) => ({
            key: line.id,
            text: `${line.label} · ${line.status}`,
            value: rupiah(line.amount),
          }))}
          empty={queue.length ? "Belum ada servis lunas" : "Belum ada servis hari ini"}
        />

        <GroupLabel
          label="Penjualan"
          count={report.sales.length}
          items={produkTerbayar.map((line) => ({
            key: line.id,
            text: line.label,
            value: rupiah(line.amount),
          }))}
          empty="Belum ada penjualan"
        />

        <GroupLabel
          label="Transaksi Kas Manual"
          count={report.cashTx.length}
          items={report.cashTx.map((line) => ({
            key: line.id,
            text: line.label,
            value: rupiah(line.amount),
          }))}
          empty="Belum ada transaksi kas"
        />
      </ul>

      {/*
       * Keempat angka ini satu blok, bukan empat baris terpisah.
       * kartu induknya sudah abu-abu, jadi latarnya yang memisahkannya dari
       * daftar di atas. Di dark mode blok ini satu tingkat lebih terang dari
       * kartu (neutral-800 vs neutral-900) - bukan putih, karena putih penuh
       * membuat mata sakit dan teksnya jadi gelap di tengah UI gelap.
       */}
      <div className="mt-1.5 shrink-0 overflow-hidden rounded-xl bg-white text-neutral-900 ring-1 ring-black/5 dark:bg-neutral-800 dark:text-neutral-100 dark:ring-white/10">
        <TotalRow label="Omzet servis" value={rupiah(report.totals.services)} />
        <TotalRow label="Omzet Penjualan" value={rupiah(report.totals.sales)} />
        <TotalRow label="Transaksi Manual" value={rupiah(report.totals.manualNet)} />
        <TotalRow label="Harus ada di laci" value={rupiah(report.expectedCash)} strong />
      </div>
    </div>
  );
}

/** Baris label-kiri, nilai-kanan, untuk blok putih rekap. */
function TotalRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b border-black/5 px-2.5 py-1.5 last:border-b-0 dark:border-white/10",
        strong && "bg-black/[0.03] font-medium dark:bg-white/[0.06]",
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Baris label-kiri, nilai-kanan. */
function Row({
  label,
  value,
  boxed = false,
  strong = false,
}: {
  label: string;
  value: string;
  boxed?: boolean;
  strong?: boolean;
}) {
  return (
    <li
      className={
        boxed
          ? "flex items-center justify-between gap-2 rounded-lg border border-black/5 px-2 py-1.5 dark:border-white/10"
          : "flex items-center justify-between gap-2 px-2 py-0.5 text-sm opacity-70"
      }
    >
      <span className={strong ? "font-medium" : undefined}>{label}</span>
      <span className={strong ? "font-medium tabular-nums" : "tabular-nums"}>{value}</span>
    </li>
  );
}

/** Judul kelompok + jumlah, lalu baris-baris di dalamnya. */
function GroupLabel({
  label,
  count,
  items,
  empty,
}: {
  label: string;
  count: number;
  items: { key: string; text: string; value: string }[];
  empty: string;
}) {
  return (
    <>
      <li className="flex items-center justify-between gap-2 px-2 py-0.5 text-sm opacity-70">
        <span>{label}</span>
        <span className="tabular-nums">({count})</span>
      </li>
      {items.length === 0 ? (
        <li className="px-2 py-0.5 text-xs opacity-40">{empty}</li>
      ) : (
        items.map((item) => (
          <li
            key={item.key}
            className="flex items-center justify-between gap-2 rounded-lg border border-black/5 px-2 py-1.5 dark:border-white/10"
          >
            <span className="min-w-0 flex-1 truncate text-xs">{item.text}</span>
            <span className="shrink-0 text-xs tabular-nums">{item.value}</span>
          </li>
        ))
      )}
    </>
  );
}

/** Tiga angka servis hari ini dalam satu strip. */
function RingkasanServis({ kpi }: { kpi: FrontlinerKpi | null }) {
  const items = [
    { label: "Masuk", value: kpi?.masuk },
    { label: "Selesai", value: kpi?.selesai },
    { label: "Diambil", value: kpi?.diambil },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-[15px] font-medium tracking-tight">Ringkasan Servis</h2>
      <div className="-mx-1 mt-1 grid min-h-0 flex-1 grid-cols-3 divide-x divide-black/5 rounded-lg border border-black/5 dark:divide-white/10 dark:border-white/10">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-1">
            <span className="font-heading text-2xl font-normal leading-none tabular-nums">
              {item.value === undefined ? "—" : String(item.value)}
            </span>
            <span className="text-[10px] opacity-60">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Servis berstatus `Selesai` yang belum dibayar.
 *
 * `queue` dari `getFrontlinerQueue()` sudah membuang servis yang punya
 * penjualan terkait, jadi filter di sini cukup status saja: pekerjaan sudah
 * selesai, barang belum diambil, dan belum ada nota yang menagihnya.
 *
 * Harga memakai `item.price` yang sudah diresolusi server menjadi
 * `price_estimasi ?? price`. Servis tanpa estimasi dan tanpa harga tampil
 * "Belum diisi", bukan "Rp0" - nol di sini berarti belum ditentukan, bukan
 * gratis.
 */
function ServisSelesaiBelumDibayar({
  queue,
  loading,
}: {
  queue: FrontlinerQueueItem[];
  loading: boolean;
}) {
  const items = queue.filter((item) => item.status === "Selesai");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-baseline justify-between gap-2">
        <h2 className="min-w-0 truncate text-[15px] font-medium tracking-tight">
          Servis Selesai Belum dibayar
        </h2>
        {loading ? null : (
          <span className="shrink-0 text-[11px] tabular-nums opacity-60">
            {items.length} servis
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-1.5 flex min-h-0 flex-1 flex-col gap-1.5" aria-hidden>
          <Skeleton className="min-h-8 flex-1 rounded-xl" />
          <Skeleton className="min-h-8 flex-1 rounded-xl" />
          <Skeleton className="min-h-8 flex-1 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-1 text-sm opacity-60">
          Tidak ada servis selesai yang belum dibayar.
        </p>
      ) : (
        <ul className="-mx-1 mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto scrollbar-none">
          {items.map((item) => (
            <li key={item.id} className="shrink-0">
              <Link
                href={`/app/servis/${item.id}`}
                className="flex items-center gap-2 rounded-xl border border-black/5 px-2.5 py-2 transition-colors hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.05]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {item.serviceNumber ?? "Tanpa nomor"}
                  </span>
                  <span className="block truncate text-[11px] opacity-60">{item.device}</span>
                </span>
                <span className="shrink-0 text-[12px] font-medium tabular-nums">
                  {item.price > 0 ? rupiah(item.price) : "Belum diisi"}
                </span>
                <ArrowRightIcon className="size-3.5 shrink-0 opacity-50" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Daftar servis terbaru; barisnya membuka detail servis. */
function TerbaruList({ queue, loading }: { queue: FrontlinerQueueItem[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="mt-1 flex min-h-0 flex-1 flex-col gap-1.5" aria-hidden>
        <Skeleton className="min-h-9 flex-1 rounded-xl" />
        <Skeleton className="min-h-9 flex-1 rounded-xl" />
        <Skeleton className="min-h-9 flex-1 rounded-xl" />
      </div>
    );
  }

  if (queue.length === 0) {
    return <p className="mt-2 text-sm opacity-60">Belum ada servis.</p>;
  }

  return (
    <ul className="-mx-1 mt-1 flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-none">
      {queue.map((item) => (
        <li key={item.id} className="shrink-0">
          <Link
            href={`/app/servis/${item.id}`}
            className="flex items-center gap-2 rounded-xl border border-black/5 px-3 py-2 transition-colors hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.05]"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">
                {item.serviceNumber ?? "Tanpa nomor"}
              </span>
              <span className="block truncate text-[11px] opacity-60">{item.device}</span>
            </span>
            <ArrowRightIcon className="size-3.5 shrink-0 opacity-50" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}
