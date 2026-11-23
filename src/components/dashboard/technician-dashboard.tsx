"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BoxIcon,
  WrenchIcon,
} from "lucide-react";
import { motion } from "motion/react";
import {
  BENTO_GRID_CLASS,
  BentoCard,
  BentoMenuItem,
  useBentoStagger,
} from "./bento-card";
import { useStyleWorld } from "@/lib/style-world-context";
import { HomeGreeting } from "@/components/ui/home-greeting";
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";
import { Separator } from "@/components/ui/separator";
import { TaskNoteCard } from "./task-note-card";
import { NewServisDialog } from "@/components/servis/new-servis-dialog";
import { toast } from "sonner";
import { getTechnicianDashboardData } from "@/app/app/actions/technician-dashboard";
import { formatCurrencyPlain } from "@/lib/format";
import type { RecentService, TechnicianKpi } from "@/lib/operational/technician-dashboard";
import {
  insentifEstimate,
  targetProgress,
  technicianCardFlags,
} from "@/lib/operational/technician-cards";
import type { TechnicianDashboardData, TechnicianHomeData } from "@/lib/home/types";

/**
 * Jarak antar kartu, dalam detik.
 *
 * 0.05 untuk 7 kartu: gerakan selesai di ~350ms, cukup untuk terbaca
 * berurutan tapi tidak terasa lambat. Kalau kartu bertambah, turunkan
 * nilainya -- 8 kartu dengan 0.05 sudah 400ms dan mulai terasa nanggung.
 */
const BENTO_STAGGER = 0.05;

/**
 * Dashboard teknisi.
 *
 * Tujuh sel, mengikuti konsep Figma: grid 4 kolom x 3 baris. Urutan sel di
 * bawah penting - CSS grid menumpuk otomatis, jadi setiap sel benar-benar
 * menduduki kotak yang sama dengan desain:
 *
 *     ┌────────┬────────┬──────────┬────────────┐
 *     │Servis  │ Data   │ Servis   │            │
 *     │ baru   │Sparepart│ Masuk  │  Servis    │
 *     ├────────┼────────┼──────────┤  terbaru   │
 *     │              │ Servis   │  (2 baris) │
 *     │   TODAY      │ Selesai  ├────────────┤
 *     │  (2x2)       ├─────────┴────────────┤
 *     │              │ Target │ Intensif    │
 *     └──────────────┴──────────────────────┘
 */

export function TechnicianDashboard({
  fullName,
  initialData,
}: {
  fullName: string | null;
  initialData: TechnicianHomeData;
}) {
  const { world } = useStyleWorld();
  const { gridProps, cardProps } = useBentoStagger(BENTO_STAGGER);

  const [newServisOpen, setNewServisOpen] = useState(false);
  /**
   * Angka dashboard sudah dirender server, jadi state ini hanya berubah saat
   * pengguna menyegarkannya sendiri (mis. setelah membuat servis baru).
   */
  const [data, setData] = useState<TechnicianDashboardData>(initialData.dashboard);

  // `router.refresh()` mengirim payload server baru tanpa me-mount ulang
  // komponen. Samakan state saat prop-nya berubah, pola yang sama dengan
  // BranchCards.
  const [syncedFrom, setSyncedFrom] = useState(initialData);
  if (syncedFrom !== initialData) {
    setSyncedFrom(initialData);
    setData(initialData.dashboard);
  }

  useEffect(() => {
    if (initialData.error) toast.error(initialData.error);
  }, [initialData.error]);

  /**
   * Menyegarkan dashboard setelah servis baru dibuat.
   *
   * Server action tetap dipakai di sini karena dialog tidak mengubah URL dan
   * `router.refresh()` tidak mengirim data dashboard ke komponen klien.
   * Kegagalan mempertahankan angka yang sudah tampil, bukan mengosongkannya.
   */
  const reload = useCallback(async () => {
    const result = await getTechnicianDashboardData();
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setData(result.data);
  }, []);

  const kpi = data.kpi;
  // Server sudah menyembunyikan kedua kartu saat insentif nonaktif, jadi di sini
  // cukup menjalankan aturan yang sama pada mode & toggle yang sudah final.
  const { showTarget, showIntensif } = technicianCardFlags({
    insentifEnabled: true,
    intensifMode: initialData.cards.intensifMode,
    showTarget: initialData.cards.showTarget,
    showIntensif: initialData.cards.showIntensif,
  });

  return (
    // Latar halaman memakai kanvas shell (abu-abu di Figma). `h-full`
    // menyambung rantai tinggi dari `main` shell: grid bento mengisi sisa
    // viewport dan berhenti di atas bottom-nav (main sudah punya padding bawah).
    <div className="flex h-full min-h-0 flex-col bg-canvas text-foreground" data-ui-world={world}>
      <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mx-auto flex min-h-0 w-full max-w-[1264px] flex-1 flex-col">
          <div className="shrink-0">
            <HomeGreeting
              dateLabel={new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              greeting={`${greeting()}, ${fullName ?? "Teknisi"}.`}
            />
          </div>



          {/* `gridProps` memasang `initial`/`animate`; kartu TIDAK memasang
              keduanya, itu syarat agar `staggerChildren` benar-benar sampai
              ke setiap kartu. */}
          <motion.div {...gridProps} className={BENTO_GRID_CLASS}>
            {/* 1. Kartu aksi - permukaannya sendiri yang candy, bukan kartu
                abu-abu yang memuat tombol di dalam. Membuka dialog, bukan
                pindah ke `/app/servis/baru`. */}
            <BentoCard
              candy="accent"
              onClick={() => setNewServisOpen(true)}
              title="Servis baru"
              cellClassName="max-sm:order-1"
            >
              <BentoMenuItem icon={WrenchIcon} label="Servis baru" />
            </BentoCard>

            {/* 2. Kartu aksi. Biru, bukan pink brand: tanpa perbedaan warna
                ini dua kartu aksi teknisi sama persis dan pink mendominasi
                dashboard. */}
            <BentoCard candy="blue" href="/app/inventori" title="Data Sparepart" cellClassName="max-sm:order-2">
              <BentoMenuItem icon={BoxIcon} label="Sparepart" />
            </BentoCard>

            {/* 3. Angka masuk hari ini. */}
            <StatTile label="Servis Masuk Hari ini" value={kpi.masukHariIni} className="max-sm:order-5" />

            {/* 4. Daftar servis terbaru, dua baris - halaman detail servis
                adalah tempat pembayaran, jadi barisnya cuma membuka detail.
                Di mobile kartu ini tampil setelah To-Do. */}
            <motion.div
              {...cardProps}
              className="min-h-0 sm:row-span-2 max-sm:order-4 max-sm:col-span-2 max-sm:max-h-[18rem]"
            >
              <TerbaruList items={data.terbaru} />
            </motion.div>

            {/* 5. To-Do, dua kolom kali dua baris. Daftar dan mention-nya sudah
                dimuat server. */}
            <motion.div
              {...cardProps}
              className="min-h-0 sm:col-span-2 sm:row-span-2 max-sm:order-3 max-sm:col-span-2"
            >
              <TaskNoteCard
                variant="bento"
                compactLimit={5}
                initialTodos={initialData.todos}
                initialMentions={initialData.mentions}
              />
            </motion.div>

            {/* 6. Angka selesai hari ini. */}
            <StatTile
              label="Servis Selesai Hari ini"
              value={kpi.selesaiHariIni}
              className="max-sm:order-6"
            />

            {/* 7. Target Cabang & Intensif Saya. Dua kartu berdampingan saat
                keduanya tampil; satu kartu melebar dua kolom saat yang lain
                disembunyikan. */}
            {showTarget && showIntensif ? (
              <>
                <BentoCard span={1} className="max-sm:order-7 max-sm:col-span-2">
                  <TargetCabangTile kpi={kpi} cards={initialData.cards} />
                </BentoCard>
                <BentoCard span={1} className="max-sm:order-7 max-sm:col-span-2">
                  <IntensifTile kpi={kpi} cards={initialData.cards} />
                </BentoCard>
              </>
            ) : showTarget ? (
              <BentoCard span={2} className="max-sm:order-7 max-sm:col-span-2">
                <TargetCabangTile kpi={kpi} cards={initialData.cards} />
              </BentoCard>
            ) : showIntensif ? (
              <BentoCard span={2} className="max-sm:order-7 max-sm:col-span-2">
                <IntensifTile kpi={kpi} cards={initialData.cards} />
              </BentoCard>
            ) : null}
          </motion.div>
        </div>
      </div>

      <NewServisDialog
        open={newServisOpen}
        onOpenChange={setNewServisOpen}
        onCreated={() => void reload()}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Isi sel
// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  className,
}: {
  label: string;
  value: number | undefined;
  className?: string;
}) {
  return (
    <BentoCard className={className}>
      <p className="text-[15px] font-medium leading-snug">{label}</p>
      <p className="font-heading mt-auto truncate text-4xl font-normal leading-none tracking-[-0.04em] tabular-nums sm:text-6xl">
        {value === undefined ? "—" : String(value)}
      </p>
    </BentoCard>
  );
}

/** Target Cabang: jumlah servis atau pendapatan bulan ini terhadap target. */
function TargetCabangTile({ kpi, cards }: { kpi: TechnicianKpi; cards: TechnicianHomeData["cards"] }) {
  const progress = targetProgress({
    type: cards.targetType,
    value: cards.targetValue,
    selesai: kpi.selesai,
    penghasilan: kpi.penghasilanBulanIni,
  });
  // `target_value` bisa null (belum diatur admin). Menampilkan "4 / 0" dan bar
  // 0% terlihat seperti data rusak, jadi kartu hanya menampilkan keterangan.
  if (progress.target === 0) {
    return (
      <>
        <p className="text-[15px] font-medium">Target Cabang</p>
        <p className="mt-auto text-sm text-muted-foreground">Belum diatur</p>
      </>
    );
  }
  return (
    <>
      <p className="text-[15px] font-medium">Target Cabang</p>
      <div className="mt-auto flex flex-wrap items-baseline gap-2">
        <p className="min-w-0 break-all text-[clamp(0.875rem,4vw,1.5rem)] font-medium tabular-nums">
          {cards.targetType === "penghasilan" ? formatCurrencyPlain(progress.current) : progress.current}
          <span className="text-sm text-muted-foreground">
            {" / "}
            {cards.targetType === "penghasilan" ? formatCurrencyPlain(progress.target) : progress.target}
          </span>
        </p>
        <span className="rounded-full border border-emerald-600/40 px-2.5 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
          {cards.targetType === "penghasilan" ? "Pendapatan" : "Servis selesai"}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progres target cabang bulan ini"
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
      >
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress.percent}%` }} />
      </div>
    </>
  );
}

/** Intensif Saya: estimasi insentif bulan ini sesuai mode cabang. */
function IntensifTile({ kpi, cards }: { kpi: TechnicianKpi; cards: TechnicianHomeData["cards"] }) {
  const estimate = insentifEstimate({
    mode: cards.intensifMode,
    value: cards.intensifValue,
    selesai: kpi.selesai,
    penghasilan: kpi.penghasilanBulanIni,
  });
  return (
    <>
      <p className="text-[15px] font-medium">Intensif Saya</p>
      <p className="font-heading mt-auto break-all text-[clamp(1rem,5vw,1.875rem)] font-normal tabular-nums">
        {formatCurrencyPlain(estimate)}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Estimasi bulan ini ·{" "}
        {cards.intensifMode === "fixed"
          ? `${formatCurrencyPlain(cards.intensifValue)} per servis`
          : `${cards.intensifValue}% dari pendapatan`}
      </p>
    </>
  );
}

/**
 * Daftar servis terbaru. Baris membuka `/app/servis/{id}` - pembayaran
 * dilakukan di halaman detail servis, bukan dari dashboard.
 */
function TerbaruList({
  items,
}: {
  items: RecentService[];
}) {
  return (
    <Frame className="flex h-full min-h-0 flex-col">
      <FrameHeader>
        <FrameTitle>Servis terbaru</FrameTitle>
      </FrameHeader>
      <FramePanel className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        {items.length === 0 ? (
          <p className="p-5 text-sm opacity-60">Belum ada servis.</p>
        ) : (
          // `overflow-y-auto` + `min-h-0`: daftar yang melebihi tinggi sel
          // menggulir di dalam kartu. Tanpa itu, `h-dvh` di luar membuat baris
          // meluber dan halaman ikut ter-scroll.
          <ul className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
            {items.map((item, index) => (
              <li key={item.id}>
                {index > 0 ? <Separator /> : null}
                <Link
                  href={`/app/servis/${item.id}`}
                  className="flex items-center gap-2 px-5 py-2.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
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
        )}
      </FramePanel>
    </Frame>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}


