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
 *     │ Transaksi Terbaru│          │            │
 *     └──────────────────┴──────────┴────────────┘
 *
 * Pembayaran tidak ada di sini. Baris "Servis terbaru" dan "Transaksi
 * Terbaru" membuka `/app/servis/{id}`, dan pembayaran dilakukan di halaman
 * detail servis.
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
   * Semua data dashboard diambil lewat satu fungsi.
   *
   * Laporan shift WAJIB ikut di sini, bukan hanya saat mount. Sebelumnya
   * `getShiftPreview` hanya dipanggil sekali, jadi begitu kasir membayar
   * servis atau mencatat kas, angka "Harus ada di laci" di Ringkasan Hari
   * ini tetap memakai nilai lama sampai halaman di-reload - terlihat seperti
   * datanya hardcoded padahal tidak.
   */
  const reload = useCallback(() => {
    getFrontlinerQueue().then((result) => {
      if (result.ok) setQueue(result.data);
    });
    getFrontlinerKpi().then((result) => {
      if (result.ok) setKpi(result.data);
    });
    checkOpenCashSession().then((result) => {
      if (!result.ok) return;
      setSession(result.data.current);
      if (!result.data.current) {
        setReport(null);
        return;
      }
      getShiftPreview(result.data.current.id).then((preview) => {
        if (preview.ok) setReport(preview.data);
      });
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    // Tinggi proporsional, bukan kunci viewport - lihat catatan panjang di
    // `BENTO_GRID_CLASS`. Ringkasan Hari ini dan daftar servis tetap
    // menggulir di dalam kartunya, karena isinya memang panjang.
    <div className="min-h-svh bg-background text-foreground">
      <div className="px-6 py-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </div>
              <h1 className="mt-1 font-heading text-3xl tracking-tight lg:text-4xl">
                {greeting()}, {fullName ?? "Frontliner"}.
              </h1>
            </div>
            <CandyButton
              tone="accent-amber"
              onClick={() => setClosingOpen(true)}
              disabled={!session}
            >
              <LockIcon className="size-4" />
              Tutup Toko
            </CandyButton>
          </div>

          {/* Kartu TIDAK memasang `initial`/`animate` sendiri; itu syarat agar
              `staggerChildren` benar-benar sampai ke tiap kartu. */}
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

            {/* 3. Rekap kas hari ini, tiga baris. */}
            <BentoCard rowSpan={3}>
              <RingkasanHariIni report={report} queue={queue} />
            </BentoCard>

            {/* 4. Daftar servis terbaru, dua baris. */}
            <BentoCard rowSpan={2} className="overflow-hidden">
              <h2 className="text-sm font-medium tracking-tight">Servis terbaru</h2>
              <TerbaruList queue={queue} />
            </BentoCard>

            {/* 5. Kartu aksi. */}
            <BentoCard candy="green" href="/app/penjualan" title="Penjualan">
              <BentoMenuItem icon={ShoppingCartIcon} label="Penjualan" />
            </BentoCard>

            {/*
              * 6. Tiga angka servis. Satu kolom, tepat di sebelah kanan
              * Penjualan. Sebelumnya `span={2}` - itu bukan sekadar "di
              * samping", dan kolom ke-3 sudah dipakai Ringkasan Hari ini
              * yang membentang tiga baris, jadi satu kolom justru satu-satunya
              * penempatan yang tidak menyisakan sel kosong.
              */}
            <BentoCard>
              <RingkasanServis kpi={kpi} />
            </BentoCard>

            {/* 7. Transaksi terakhir, melebar dua kolom. `hug` supaya kartu
                ikut tinggi daftarnya, bukan meregang sampai tinggi baris -
                kalau tidak, kartu ini terlihat setengah kosong. */}
            <BentoCard span={2} hug>
              <TransaksiTerbaru queue={queue} />
            </BentoCard>

            {/* 8. To-Do, satu sel. */}
            <BentoCard className="overflow-visible">
              <TaskNoteCard compact compactLimit={3} />
            </BentoCard>
          </motion.div>
        </div>
      </div>

      <AdjustmentDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        onSaved={reload}
      />
      <ClosingDialog
        open={closingOpen}
        onOpenChange={setClosingOpen}
        session={session}
        onClosed={reload}
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
}: {
  report: ShiftReport | null;
  queue: FrontlinerQueueItem[];
}) {
  if (!report) {
    return (
      <>
        <h2 className="text-sm font-medium tracking-tight">Ringkasan Hari ini</h2>
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
      <h2 className="text-sm font-medium tracking-tight">Ringkasan Hari ini</h2>

      <ul className="-mx-1 mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto scrollbar-none">
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

        {/*
         * Keempat angka ini satu blok putih, bukan empat baris terpisah.
         * kartu induknya sudah abu-abu, jadi latar putih di sini yang
         * memisahkannya dari daftar di atas.
         */}
        <li className="mt-1 overflow-hidden rounded-lg bg-white text-neutral-900 ring-1 ring-black/5 dark:bg-white/95 dark:ring-white/10">
          <TotalRow label="Omzet servis" value={rupiah(report.totals.services)} />
          <TotalRow label="Omzet Penjualan" value={rupiah(report.totals.sales)} />
          <TotalRow label="Transaksi Manual" value={rupiah(report.totals.manualNet)} />
          <TotalRow label="Harus ada di laci" value={rupiah(report.expectedCash)} strong />
        </li>
      </ul>
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
      <h2 className="text-sm font-medium tracking-tight">Ringkasan Servis</h2>
      <div className="-mx-1 mt-1 grid min-h-0 flex-1 grid-cols-3 divide-x divide-black/5 rounded-lg border border-black/5 dark:divide-white/10 dark:border-white/10">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-1">
            <span className="font-heading text-2xl font-semibold leading-none tabular-nums">
              {item.value === undefined ? "—" : String(item.value)}
            </span>
            <span className="text-[10px] opacity-60">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Kartu horizontal servis terakhir, dengan tautan "Lihat semua". */
function TransaksiTerbaru({ queue }: { queue: FrontlinerQueueItem[] }) {
  return (
    // Tanpa `flex-1`/`min-h-0`: kartu ini sengaja hug, jadi tinggi wrapper
    // ikut tinggi isinya dan tidak menarik ruang kosong.
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium tracking-tight">Transaksi Terbaru</h2>
        <Link href="/app/servis" className="text-xs underline underline-offset-2 opacity-70">
          Lihat semua
        </Link>
      </div>

      {queue.length === 0 ? (
        <p className="mt-1 text-sm opacity-60">Belum ada servis hari ini.</p>
      ) : (
        <ul className="-mx-1 mt-1 flex gap-1.5 overflow-x-auto scrollbar-none">
          {queue.map((item) => (
            <li key={item.id} className="min-w-[8rem] shrink-0">
              <Link
                href={`/app/servis/${item.id}`}
                className="flex min-w-0 flex-col rounded-lg border border-black/5 px-2 py-1.5 transition-colors hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.05]"
              >
                <span className="text-[10px] opacity-50 tabular-nums">
                  {new Date(item.createdAt).toLocaleDateString("id-ID")}
                </span>
                <span className="mt-0.5 flex min-w-0 flex-1 items-center gap-1">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {item.serviceNumber ?? "Tanpa nomor"}
                    </span>
                    <span className="block truncate text-[11px] opacity-60">{item.device}</span>
                  </span>
                  <ArrowRightIcon className="size-3.5 shrink-0 opacity-50" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Daftar servis terbaru; barisnya membuka detail servis. */
function TerbaruList({ queue }: { queue: FrontlinerQueueItem[] }) {
  if (queue.length === 0) {
    return <p className="mt-2 text-sm opacity-60">Belum ada servis.</p>;
  }

  return (
    <ul className="-mx-1 mt-1 flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-none">
      {queue.map((item) => (
        <li key={item.id} className="shrink-0">
          <Link
            href={`/app/servis/${item.id}`}
            className="flex items-center gap-2 rounded-lg border border-black/5 px-2.5 py-1.5 transition-colors hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.05]"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">
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
