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
import { toast } from "sonner";
import {
  BENTO_GRID_CLASS,
  BentoCard,
  BentoMenuItem,
  useBentoStagger,
} from "./bento-card";
import { CandyButton } from "@/components/ui/candy-button";
import { TaskNoteCard } from "./task-note-card";
import { NewServisDialog } from "@/components/servis/new-servis-dialog";
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
import type { FrontlinerHomeData } from "@/lib/home/types";
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

type FrontlinerState = {
  queue: FrontlinerQueueItem[];
  kpi: FrontlinerKpi | null;
  session: CashSessionRow | null;
  report: ShiftReport | null;
};

function frontlinerState(data: FrontlinerHomeData): FrontlinerState {
  return {
    queue: data.queue,
    kpi: data.kpi,
    session: data.session,
    report: data.report,
  };
}

export function FrontlinerDashboard({
  fullName,
  initialData,
}: {
  fullName: string | null;
  initialData: FrontlinerHomeData;
}) {
  const { gridProps } = useBentoStagger(BENTO_STAGGER);

  /**
   * Satu objek, bukan empat state terpisah: data awal datang dari server, dan
   * menyegarkannya setelah aksi (bayar, catat kas, tutup toko) berarti
   * mengganti keempatnya sekaligus.
   */
  const [data, setData] = useState<FrontlinerState>(() => frontlinerState(initialData));
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [closingOpen, setClosingOpen] = useState(false);
  const [newServisOpen, setNewServisOpen] = useState(false);

  // `router.refresh()` mengirim payload server baru tanpa me-mount ulang
  // komponen. Samakan state saat prop-nya berubah, pola yang sama dengan
  // BranchCards.
  const [syncedFrom, setSyncedFrom] = useState(initialData);
  if (syncedFrom !== initialData) {
    setSyncedFrom(initialData);
    setData(frontlinerState(initialData));
  }

  const { queue, kpi, session, report } = data;

  useEffect(() => {
    // Satu kali per pesan; string yang sama tidak memicu toast berulang saat
    // payload server disegarkan.
    if (initialData.error) toast.error(initialData.error);
  }, [initialData.error]);

  /**
   * Menyegarkan data setelah pengguna melakukan sesuatu.
   *
   * Laporan shift WAJIB ikut di sini, bukan hanya saat mount. Sebelumnya
   * `getShiftPreview` hanya dipanggil sekali, jadi begitu kasir membayar
   * servis atau mencatat kas, angka "Harus ada di laci" di Ringkasan Hari
   * ini tetap memakai nilai lama sampai halaman di-reload - terlihat seperti
   * datanya hardcoded padahal tidak.
   *
   * Ketiga query pertama berjalan paralel, lalu preview menyusul karena
   * butuh id sesi. Yang gagal mempertahankan nilai sebelumnya, bukan
   * mengosongkan kartu.
   */
  const reload = useCallback(async () => {
    const [queueResult, kpiResult, sessionResult] = await Promise.all([
      getFrontlinerQueue(),
      getFrontlinerKpi(),
      checkOpenCashSession(),
    ]);

    setData((prev) => ({
      queue: queueResult.ok ? queueResult.data : prev.queue,
      kpi: kpiResult.ok ? kpiResult.data : prev.kpi,
      session: sessionResult.ok ? sessionResult.data.current : prev.session,
      report: sessionResult.ok && !sessionResult.data.current ? null : prev.report,
    }));

    if (!sessionResult.ok || !sessionResult.data.current) return;

    const preview = await getShiftPreview(sessionResult.data.current.id);
    if (preview.ok) setData((prev) => ({ ...prev, report: preview.data }));
  }, []);

  return (
    // Latar halaman memakai kanvas shell. `h-full` menyambung rantai tinggi
    // dari `main` shell: grid bento mengisi sisa viewport dan berhenti tepat
    // di atas bottom-nav (main sudah punya `pb-24`), bukan menggulir halaman.
    <div className="flex h-full min-h-0 flex-col bg-canvas text-foreground">
      <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mx-auto flex min-h-0 w-full max-w-[1264px] flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
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
          {/* Tidak ada lagi pembungkus ASCII/skeleton di sini: angkanya sudah
              dirender server, jadi grid langsung berisi data pada paint
              pertama. */}
          <div className="flex min-h-0 flex-1 flex-col">
            <motion.div {...gridProps} className={BENTO_GRID_CLASS}>
              {/* 1. Kartu aksi - permukaannya sendiri yang candy. Membuka
                  dialog, bukan pindah ke `/app/servis/baru`: formulirnya tidak
                  butuh halaman sendiri dan kasir tidak kehilangan dashboard. */}
              <BentoCard
                candy="accent"
                onClick={() => setNewServisOpen(true)}
                title="Servis baru"
              >
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
                <RingkasanHariIni report={report} queue={queue} />
              </BentoCard>

              {/* 4. Daftar servis terbaru, dua baris. Putih di mobile seperti
                  frame Figma. */}
              <BentoCard
                rowSpan={2}
                className="max-sm:col-span-2 max-sm:bg-white/70 max-sm:hover:bg-white/70 max-sm:dark:bg-white/[0.06] max-sm:dark:hover:bg-white/[0.06]"
              >
                <h2 className="text-[15px] font-medium tracking-tight">Servis terbaru</h2>
                <TerbaruList queue={queue} />
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
                <ServisSelesaiBelumDibayar queue={queue} />
              </BentoCard>

              {/* 8. To-Do, satu sel di desktop; di mobile selebar dua kolom.
                  Seluruh tugas tampil - di desktop daftarnya menggulir di
                  dalam sel, di mobile kartunya ikut tinggi isi. Daftar dan
                  mention-nya sudah dimuat server, jadi kartu tidak perlu
                  meminta ulang saat mount. */}
              <BentoCard className="max-sm:col-span-2">
                <TaskNoteCard
                  variant="compact"
                  initialTodos={initialData.todos}
                  initialMentions={initialData.mentions}
                />
              </BentoCard>
            </motion.div>
          </div>
        </div>
      </div>

      <NewServisDialog
        open={newServisOpen}
        onOpenChange={setNewServisOpen}
        onCreated={() => void reload()}
      />
      <AdjustmentDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        onSaved={() => void reload()}
      />
      <ClosingDialog
        open={closingOpen}
        onOpenChange={setClosingOpen}
        session={session}
        initialReport={report}
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
}: {
  report: ShiftReport | null;
  queue: FrontlinerQueueItem[];
}) {
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
       * daftar di atas. Putih penuh (#fff) di atas #E7E7E7 terlalu kontras -
       * blok ini jadi bidang paling terang di dashboard. `white/55` menjaga
       * pemisahan tanpa menarik mata, dan dark mode memakai lapisan putih tipis
       * di atas neutral-900 alih-alih neutral-800 yang juga terlalu terang.
       */}
      <div className="mt-1.5 shrink-0 overflow-hidden rounded-xl bg-white/55 text-neutral-900 ring-1 ring-black/5 dark:bg-white/[0.06] dark:text-neutral-100 dark:ring-white/10">
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
function ServisSelesaiBelumDibayar({ queue }: { queue: FrontlinerQueueItem[] }) {
  const items = queue.filter((item) => item.status === "Selesai");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-baseline justify-between gap-2">
        <h2 className="min-w-0 truncate text-[15px] font-medium tracking-tight">
          Servis Selesai Belum dibayar
        </h2>
        <span className="shrink-0 text-[11px] tabular-nums opacity-60">
          {items.length} servis
        </span>
      </div>

      {items.length === 0 ? (
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
