"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ChevronRightIcon,
  LockIcon,
  PackageCheckIcon,
  ScanBarcodeIcon,
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
import SignaturePad from "@/components/kokonutui/signature-pad";
import { CandyButton } from "@/components/ui/candy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShiftDetailDialog } from "@/components/cash/shift-detail-dialog";
import { BarcodeScannerDialog } from "@/components/scan/barcode-scanner-dialog";
import { TaskNoteCard } from "./task-note-card";
import { NewServisDialog } from "@/components/servis/new-servis-dialog";
import { ServisPaymentDialog } from "@/components/servis/servis-payment-dialog";
import { AdjustmentDialog } from "@/components/cash/adjustment-dialog";
import { ClosingDialog } from "@/components/cash/closing-dialog";
import {
  checkOpenCashSession,
  getFrontlinerKpi,
  getFrontlinerQueue,
  getShiftPreview,
  searchPickupServices,
  type CashSessionRow,
  type FrontlinerKpi,
  type FrontlinerQueueItem,
} from "@/app/app/actions/cash";
import { confirmServisPickup } from "@/app/app/servis/sparepart-actions";
import type { FrontlinerHomeData, PickupServiceItem } from "@/lib/home/types";
import { rupiah, type ShiftReport } from "@/lib/operational/laporan-shift";
import { servisOutstanding } from "@/lib/operational/servis-price";
import { kalenderWIB } from "@/lib/operational/periode-bulan";
import { cn } from "@/lib/utils";
import { playPageTransition } from "@/components/layout/page-transition";

/**
 * Jarak antar kartu, dalam detik.
 *
 * 0.04 untuk 8 kartu. Lebih kecil dari dashboard teknisi (0.05 untuk 7
 * kartu) karena dua kartu di sini membentang dua dan tiga baris sehingga
 * gerakannya lebih lama terlihat, dan 8 x 0.05 sudah 400ms.
 */
const BENTO_STAGGER = 0.04;

/** Baris yang ditampilkan per grup di Ringkasan sebelum "+N lainnya". */
const GROUP_PREVIEW_ROWS = 3;

/** Baris servis terbaru yang ditampilkan sebelum tautan "Lihat semua". */
const TERBARU_PREVIEW_ROWS = 6;

/**
 * Tanggal shift dalam bentuk pendek, mis. `2026-10-24` -> "24 Okt".
 *
 * `report.date` sudah berupa tanggal kalender WIB, jadi tengah malam UTC
 * dipakai sebagai titik acuan supaya tidak bergeser satu hari di klien yang
 * zona waktunya bukan WIB.
 */
function shortShiftDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

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
  initialAction = null,
}: {
  fullName: string | null;
  initialData: FrontlinerHomeData;
  /** Deep-link dari command palette: buka dialog kas saat halaman dimuat. */
  initialAction?: "catat-kas" | "tutup-kas" | null;
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

  // Shift yang dibuka kemarin dan belum ditutup tetap menjadi `session` aktif:
  // index unik hanya mengizinkan satu sesi terbuka per karyawan. Rekapnya benar
  // - ia memuat transaksi sejak shift dibuka - tapi judulnya tidak boleh
  // berbunyi "Hari ini", dan pengguna perlu tahu kenapa.
  const shiftDate = report?.date ?? null;
  const staleDate = shiftDate && shiftDate !== kalenderWIB() ? shiftDate : null;

  /**
   * Catat Kas butuh sesi terbuka: tanpa sesi, baris kas manual tidak masuk
   * rekap mana pun. Kartunya diredupkan dan kliknya menjelaskan alasannya,
   * bukan diam saja.
   */
  const openAdjustment = () => {
    if (!session) {
      toast.error("Buka kas dulu sebelum mencatat kas");
      return;
    }
    setAdjustOpen(true);
  };

  // Deep-link `?action=catat-kas|tutup-kas` dari command palette. Hanya sekali
  // saat mount; setelah dialog ditutup pengguna tetap di dashboard.
  useEffect(() => {
    if (initialAction === "catat-kas") openAdjustment();
    if (initialAction === "tutup-kas") setClosingOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // di atas bottom-nav (main sudah punya padding bawah), bukan menggulir halaman.
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

          {staleDate ? (
            <div className="mt-3 flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px]">
              <span className="font-medium">Shift {shortShiftDate(staleDate)} masih terbuka.</span>
              <span className="opacity-70">
                Rekap memuat transaksi sejak shift dibuka sampai hari ini. Tutup shift lewat
                tombol Tutup Toko supaya laporan hari ini terpisah.
              </span>
            </div>
          ) : null}

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
                cellClassName="max-sm:order-3"
              >
                <BentoMenuItem icon={WrenchIcon} label="Servis baru" />
              </BentoCard>

              {/* 2. Kartu aksi. Satu-satunya sel aksi yang bukan tautan -
                  "Catat Kas" membuka dialog. Tanpa sesi terbuka, kas manual
                  tidak akan masuk rekap mana pun, jadi kartunya diredupkan dan
                  menjelaskan kenapa saat diklik. */}
              <BentoCard
                candy="amber"
                onClick={openAdjustment}
                title="Catat Kas"
                className={session ? undefined : "opacity-60"}
                cellClassName="max-sm:order-4"
              >
                <BentoMenuItem icon={WalletIcon} label="Catat Kas" />
              </BentoCard>

              {/* 3. Rekap kas hari ini, tiga baris. Di mobile menjadi kartu
                  selebar dua kolom. */}
              <BentoCard rowSpan={3} className="max-sm:col-span-2" cellClassName="max-sm:order-7">
                <RingkasanHariIni
                  report={report}
                  queue={queue}
                  staleDate={staleDate}
                  onCloseShop={() => setClosingOpen(true)}
                />
              </BentoCard>

              {/* 3b. Daftar servis terbaru */}
              <BentoCard
                rowSpan={1}
                className="max-sm:col-span-2 max-sm:bg-white/70 max-sm:hover:bg-white/70 max-sm:dark:bg-white/[0.06] max-sm:dark:hover:bg-white/[0.06]"
                cellClassName="max-sm:order-9"
              >
                <h2 className="text-[15px] font-medium tracking-tight">Servis terbaru</h2>
                <TerbaruList queue={queue} />
              </BentoCard>

              {/* 4. Device siap diambil */}
              <PengambilanDeviceCard queue={queue} onSaved={() => void reload()} />

              {/* 5. Kartu aksi. Di mobile naik ke bawah Catat Kas. */}
              <BentoCard
                candy="green"
                href="/app/penjualan"
                title="Penjualan"
                cellClassName="max-sm:order-5"
              >
                <BentoMenuItem icon={ShoppingCartIcon} label="Penjualan" />
              </BentoCard>

              {/* 6. Sisa antrean + tiga angka servis hari ini, satu kolom. Di
                  mobile selebar dua kolom. */}
              <BentoCard className="max-sm:col-span-2" cellClassName="max-sm:order-8">
                <RingkasanServis kpi={kpi} />
              </BentoCard>

              {/* 7. Servis selesai yang belum dibayar, melebar dua kolom.
                  Tanpa `hug`: kartu mengisi sel bento dan daftarnya menggulir
                  di dalam, jadi tingginya selalu sama dengan kartu tetangga. */}
              <BentoCard span={2} className="max-sm:col-span-2" cellClassName="max-sm:order-1">
                <ServisSelesaiBelumDibayar queue={queue} />
              </BentoCard>

              {/* 8. To-Do, satu sel di desktop; di mobile selebar dua kolom.
                  Seluruh tugas tampil - di desktop daftarnya menggulir di
                  dalam sel, di mobile kartunya ikut tinggi isi. Daftar dan
                  mention-nya sudah dimuat server, jadi kartu tidak perlu
                  meminta ulang saat mount. */}
              <BentoCard className="max-sm:col-span-2" cellClassName="max-sm:order-2">
                <TaskNoteCard
                  variant="compact"
                  initialTodos={initialData.todos}
                  initialMentions={initialData.mentions}
                />
              </BentoCard>
            </motion.div>

            {/* Ruang gulir ekstra di mobile: To-Do adalah kartu terakhir dan
                sebelumnya tertutup bottom bar. */}
            <div aria-hidden className="h-24 shrink-0 sm:hidden" />
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
  staleDate,
  onCloseShop,
}: {
  report: ShiftReport | null;
  queue: FrontlinerQueueItem[];
  /** Tanggal buka shift kalau bukan hari ini; null untuk shift hari ini. */
  staleDate: string | null;
  /** Membuka dialog Tutup Toko dari dalam detail shift. */
  onCloseShop: () => void;
}) {
  // Shift yang masih terbuka sejak kemarin bukan "hari ini": judulnya harus
  // menyebut tanggalnya supaya angka di dalamnya tidak disalahartikan.
  const title = staleDate ? `Ringkasan Shift ${shortShiftDate(staleDate)}` : "Ringkasan Hari ini";
  const [detailOpen, setDetailOpen] = useState(false);

  if (!report) {
    return (
      <>
        <h2 className="shrink-0 text-[15px] font-medium tracking-tight">{title}</h2>
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
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-black/[0.05] dark:bg-white/[0.08]">
            <WalletIcon className="size-4 opacity-70" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] opacity-50">Rekap kas</p>
            <h2 className="truncate text-[15px] font-semibold leading-tight tracking-tight">{title}</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="flex shrink-0 items-center gap-0.5 rounded-full border border-black/10 bg-white/40 px-2 py-1 text-[11px] font-medium opacity-70 transition hover:opacity-100 dark:border-white/15 dark:bg-white/[0.06]"
        >
          Detail
          <ChevronRightIcon className="size-3" />
        </button>
      </div>

      {/* Hanya daftar ini yang menggulir. Blok total di bawah sengaja berada
          di luar `<ul>` supaya tetap terlihat saat daftar transaksi panjang. */}
      <ul className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1 text-[13px] scrollbar-thin">
        <Row label="Saldo Awal" value={rupiah(report.openingBalance)} />

        <GroupLabel
          icon={WrenchIcon}
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
          icon={ShoppingCartIcon}
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
          icon={WalletIcon}
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
       * blok ini jadi bidang paling terang di dashboard. `white/60` menjaga
       * pemisahan tanpa menarik mata, dan dark mode memakai lapisan putih tipis
       * di atas neutral-900 alih-alih neutral-800 yang juga terlalu terang.
       */}
      <div className="mt-2 shrink-0 rounded-xl bg-white/60 p-2.5 ring-1 ring-black/5 dark:bg-white/[0.06] dark:ring-white/10">
        <TotalRow label="Omzet servis" value={rupiah(report.totals.services)} />
        <TotalRow label="Omzet Penjualan" value={rupiah(report.totals.sales)} />
        <TotalRow label="Transaksi Manual" value={rupiah(report.totals.manualNet)} />
        <div className="my-2 h-px bg-black/[0.08] dark:bg-white/10" />
        <div className="flex items-baseline justify-between gap-2 px-0.5">
          <span className="text-xs font-medium">Harus ada di laci</span>
          <span className="text-lg font-semibold leading-none tabular-nums">{rupiah(report.expectedCash)}</span>
        </div>
      </div>

      <ShiftDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        report={report}
        title={title}
        onCloseShop={() => {
          // Tutup detail dulu: Tutup Toko punya dialog sendiri, dan dua modal
          // bertumpuk membuat urutan Escape/focus tidak jelas.
          setDetailOpen(false);
          onCloseShop();
        }}
      />
    </div>
  );
}

/** Baris label-kiri, nilai-kanan, untuk blok total rekap. */
function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-0.5 py-1 text-xs">
      <span className="opacity-65">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

/** Baris pembuka (saldo awal). */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg bg-black/[0.04] px-2.5 py-2 dark:bg-white/[0.06]">
      <span className="text-xs opacity-65">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </li>
  );
}

/** Judul kelompok + jumlah, lalu baris-baris di dalamnya. */
function GroupLabel({
  icon: Icon,
  label,
  count,
  items,
  empty,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  count: number;
  items: { key: string; text: string; value: string }[];
  empty: string;
}) {
  // Preview saja. Jumlah baris tidak boleh menentukan tinggi kartu: 10 atau 100
  // transaksi harus tetap setinggi kartu tetangganya. Sisanya dibuka di tempat
  // karena frontliner tidak punya akses ke /app/laporan/shift.
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, GROUP_PREVIEW_ROWS);
  const hidden = items.length - shown.length;

  return (
    <>
      <li className="mt-3 flex items-center gap-1.5 px-2.5 pb-1 text-[10px] font-medium uppercase tracking-[0.12em] opacity-55">
        <Icon className="size-3" />
        <span className="flex-1">{label}</span>
        <span className="rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums dark:bg-white/[0.08]">
          {count}
        </span>
      </li>
      {items.length === 0 ? (
        <li className="px-2.5 py-1 text-xs italic opacity-40">{empty}</li>
      ) : (
        <>
          {shown.map((item, index) => (
            <li
              key={item.key}
              className={cn(
                "flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs",
                index < shown.length - 1 && "border-b border-black/[0.04] dark:border-white/[0.06]",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{item.text}</span>
              <span className="shrink-0 font-medium tabular-nums">{item.value}</span>
            </li>
          ))}
          {hidden > 0 ? (
            <li>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="mt-0.5 flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs opacity-60 transition-opacity hover:opacity-100"
              >
                <span>+{hidden} lainnya</span>
                <ArrowRightIcon className="size-3" />
              </button>
            </li>
          ) : null}
        </>
      )}
    </>
  );
}

/**
 * Sisa antrean sebagai angka utama, tiga angka harian sebagai pendamping.
 *
 * Dua kelompok ini beda rentang: `proses` menghitung semua servis yang masih
 * dikerjakan (lintas hari), sedangkan masuk/selesai/diambil hanya servis yang
 * dibuat hari ini. Karena itu keduanya dipisah jadi dua panel, bukan satu baris
 * empat angka yang seolah sebentuk.
 */
function RingkasanServis({ kpi }: { kpi: FrontlinerKpi | null }) {
  const harian = [
    { label: "Masuk", value: kpi?.masuk },
    { label: "Selesai", value: kpi?.selesai },
    { label: "Diambil", value: kpi?.diambil },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-[15px] font-medium tracking-tight">Ringkasan Servis</h2>
      <div className="mt-2 grid min-h-0 flex-1 grid-cols-[1.05fr_1fr] gap-2">
        <div className="flex min-w-0 flex-col justify-center rounded-xl bg-brand/[0.08] px-3 py-2">
          <span className="font-heading text-[2.25rem] font-normal leading-none tracking-[-0.03em] tabular-nums sm:text-[2.5rem]">
            {kpi?.proses === undefined ? "—" : String(kpi.proses)}
          </span>
          <span className="mt-1.5 flex items-center gap-1 text-[11px] font-medium leading-none">
            <span className="size-1.5 rounded-full bg-brand" />
            Antrian
          </span>
          <span className="mt-1 text-[10px] leading-none opacity-50">sisa proses</span>
        </div>
        <div className="flex min-w-0 flex-col justify-center divide-y divide-black/5 dark:divide-white/10">
          {harian.map((item) => (
            <div key={item.label} className="flex items-baseline justify-between gap-2 py-2 first:pt-0 last:pb-0">
              <span className="truncate text-[11px] leading-none opacity-60">{item.label}</span>
              <span className="font-heading shrink-0 text-base leading-none tabular-nums">
                {item.value === undefined ? "—" : String(item.value)}
              </span>
            </div>
          ))}
        </div>
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
        <ul className="-mx-1 mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto scrollbar-thin pr-1">
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

  // Antrean bisa berisi ratusan servis. Kartu ini hanya memuat yang terbaru;
  // sisanya di halaman Servis.
  const shown = queue.slice(0, TERBARU_PREVIEW_ROWS);
  const hidden = queue.length - shown.length;

  return (
    <>
      <ul className="-mx-1 mt-1 flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin pr-1">
        {shown.map((item) => (
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
      {hidden > 0 ? (
        <Link
          href="/app/servis"
          className="mt-1 flex shrink-0 items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs opacity-60 transition-opacity hover:opacity-100"
        >
          <span>+{hidden} servis lainnya</span>
          <ArrowRightIcon className="size-3" />
        </Link>
      ) : null}
    </>
  );
}

/**
 * Kartu candy "Pengambilan Device".
 *
 * Satu sel saja: daftar hasil pencarian hidup di dialog, jadi kartu ini tetap
 * ringkas dan tidak mendorong kartu lain keluar grid.
 */
function PengambilanDeviceCard({ queue, onSaved }: { queue: FrontlinerQueueItem[]; onSaved?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <BentoCard candy="blue" onClick={() => setOpen(true)} title="Pengambilan Device" cellClassName="max-sm:order-6">
        <span className="flex flex-1 flex-col items-start justify-between gap-3">
          <PackageCheckIcon className="size-7 drop-shadow-sm" />
          <span className="text-[15px] font-medium leading-tight">
            Pengambilan Device
          </span>
        </span>
      </BentoCard>
      <PickupDialog open={open} onOpenChange={setOpen} queue={queue} onSaved={onSaved} />
    </>
  );
}

/**
 * Panel pencarian device siap diambil (`Selesai`).
 *
 * Pencarian menunggu 250 ms setelah ketikan terakhir supaya satu kata tidak
 * mengirim satu query per huruf. Scan memakai kamera lewat
 * `BarcodeScannerDialog`; hasilnya masuk ke kolom pencarian.
 */
function PickupDialog({ open, onOpenChange, queue, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; queue: FrontlinerQueueItem[]; onSaved?: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickupServiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [confirmItem, setConfirmItem] = useState<PickupServiceItem | null>(null);
  const [payItem, setPayItem] = useState<PickupServiceItem | null>(null);
  const [pickedBy, setPickedBy] = useState("");
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dialog ditutup = pencarian lama dibuang, supaya buka berikutnya bersih.
  if (!open && (query !== "" || results.length > 0)) {
    setQuery("");
    setResults([]);
  }

  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void searchPickupServices(term).then((result) => {
        if (cancelled) return;
        setLoading(false);
        if (result.ok) setResults(result.data);
        else {
          setResults([]);
          toast.error(result.error);
        }
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  // Antrean rekomendasi belum punya baris kas, jadi dianggap belum dibayar.
  const fromQueue = (item: FrontlinerQueueItem): PickupServiceItem => ({
    id: item.id,
    serviceNumber: item.serviceNumber,
    device: item.device,
    customerName: item.customerName,
    customerPhone: null,
    updatedAt: item.createdAt,
    bill: item.price,
    paidAmount: 0,
  });

  /**
   * Servis yang belum lunas harus dibayar dulu. Dialog pickup ditutup selama
   * pembayaran supaya dua dialog tidak bertumpuk, lalu dibuka lagi di form
   * tanda tangan setelah `onPaid`.
   */
  const startPickup = (item: PickupServiceItem) => {
    if (servisOutstanding(item.bill, item.paidAmount) > 0) {
      setPayItem(item);
      onOpenChange(false);
      return;
    }
    setConfirmItem(item);
  };

  const finishPayment = () => {
    const item = payItem;
    setPayItem(null);
    onOpenChange(true);
    if (item) setConfirmItem(item);
    onSaved?.();
  };

  const handleSave = async () => {
    if (!confirmItem || saving) return;
    if (!signature.startsWith("<svg")) {
      toast.error("Tanda tangan wajib diisi");
      return;
    }
    setSaving(true);
    try {
      await confirmServisPickup(confirmItem.id, signature, pickedBy.trim() || null);
      playPageTransition();
      toast.success("Pengambilan dicatat");
      setConfirmItem(null);
      setPickedBy("");
      setSignature("");
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan pengambilan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {confirmItem ? (
          <>
            <DialogHeader>
              <DialogTitle>Pengambilan Device</DialogTitle>
              <DialogDescription>
                {confirmItem.serviceNumber ?? "Tanpa nomor"} · {confirmItem.device}
                <span className="block text-xs opacity-60 mt-1">{confirmItem.customerName ?? "-"}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Siapa yang mengambil</label>
                <Input value={pickedBy} onChange={(e) => setPickedBy(e.target.value)} placeholder="Nama pengambil" />
              </div>
              <div>
                <label className="text-sm font-medium">Tanda tangan</label>
                <SignaturePad className="max-w-none" onChange={(svg) => setSignature(svg ?? "")} label="Tanda tangan" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setConfirmItem(null); setPickedBy(""); setSignature(""); }}>Batal</Button>
                <Button type="button" onClick={() => void handleSave()} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Pengambilan Device</DialogTitle>
              <DialogDescription>
                Cari device yang sudah selesai dikerjakan dan siap diambil.
              </DialogDescription>
            </DialogHeader>

        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="No. servis / nama customer / no. HP"
            aria-label="Cari device siap diambil"
          />
          <CandyButton
            type="button"
            tone="accent-cyan"
            aria-label="Scan barcode"
            title="Scan barcode"
            onClick={() => setScanOpen(true)}
            className="shrink-0 gap-1.5 px-3"
          >
            <ScanBarcodeIcon className="size-4" />
            <span className="text-xs font-medium">Scan</span>
          </CandyButton>
        </div>

        <div className="max-h-[280px] overflow-y-auto scrollbar-thin">
          {query.trim().length < 2 ? (
            <div className="space-y-1.5">
              <p className="text-sm opacity-60">Ketik minimal 2 karakter atau scan barcode.</p>
              {/* Rekomendasi siap diambil */}
              <ul className="space-y-1">
                {queue.filter((i: any) => i.status === "Selesai").slice(0, 3).map((item: any) => (
                  <li key={item.id ?? item.serviceNumber}>
                    <button
                      onClick={() => { startPickup(fromQueue(item)); }}
                      className="w-full text-left truncate text-sm px-1 py-1 rounded hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                    >
                      <span className="font-medium">{item.serviceNumber ?? "Tanpa nomor"}</span>
                      <span className="opacity-60"> · {item.device}</span>
                      <span className="opacity-50"> · {item.customerName ?? "-"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : loading ? (
            <p className="text-sm opacity-60">Mencari...</p>
          ) : results.length === 0 ? (
            <p className="text-sm opacity-60">Tidak ada device siap diambil yang cocok.</p>
          ) : (() => {
            const list = (query.trim().length < 2 ? queue.filter((i: any) => i.status === "Selesai") : results);
            if (list.length === 0) return <p className="text-sm opacity-60">Tidak ada device siap diambil.</p>;
            const visible = list.slice(0, 5);
            return (
              <ul className="space-y-1.5 max-h-[240px] overflow-y-auto scrollbar-thin">
                {visible.map((item: any) => (
                  <li key={item.id ?? item.serviceNumber ?? item.device}>
                    <button
                      onClick={() => {
                        startPickup(item);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl border border-black/5 px-3 py-2 text-left transition-colors hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.05]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">
                          {item.serviceNumber ?? "Tanpa nomor"} · {item.device}
                        </span>
                        <span className="block truncate text-[11px] opacity-60">
                          {item.customerName ?? "Tanpa nama"}
                          {item.customerPhone ? ` · ${item.customerPhone}` : ""}
                        </span>
                      </span>
                      {servisOutstanding(item.bill, item.paidAmount) > 0 ? (
                        <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          Belum dibayar
                        </span>
                      ) : null}
                      <ArrowRightIcon className="size-3.5 shrink-0 opacity-50" />
                    </button>
                  </li>
                ))}
                {list.length > 5 ? <li className="text-xs opacity-60 px-1">+{list.length - 5} lainnya</li> : null}
              </ul>
            );
          })()}
        </div>
      </>
    )}
      </DialogContent>
    </Dialog>
      <BarcodeScannerDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        title="Scan barcode"
        description="Arahkan kamera ke barcode pada nota servis."
        onDetected={(value) => setQuery(value)}
      />

      <ServisPaymentDialog
        servisId={payItem?.id ?? null}
        open={payItem !== null}
        onOpenChange={(value) => { if (!value) setPayItem(null); }}
        onPaid={finishPayment}
      />
    </>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}
