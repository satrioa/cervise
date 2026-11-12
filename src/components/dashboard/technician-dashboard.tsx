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
import type { RecentService, TechnicianKpi } from "@/lib/operational/technician-dashboard";
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
 *     │              │     Target saya      │
 *     └──────────────┴──────────────────────┘
 */

export function TechnicianDashboard({
  fullName,
  initialData,
}: {
  fullName: string | null;
  initialData: TechnicianHomeData;
}) {
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

  return (
    // Latar halaman memakai kanvas shell (abu-abu di Figma). `h-full`
    // menyambung rantai tinggi dari `main` shell: grid bento mengisi sisa
    // viewport dan berhenti di atas bottom-nav (main sudah punya padding bawah).
    <div className="flex h-full min-h-0 flex-col bg-canvas text-foreground">
      <div className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mx-auto flex min-h-0 w-full max-w-[1264px] flex-1 flex-col">
          <div className="shrink-0">
            <DateLine />
            <h1 className="mt-1 font-heading text-[2rem] font-normal leading-tight tracking-[-0.03em] sm:text-[2.5rem]">
              {greeting()}, {fullName ?? "Teknisi"}.
            </h1>
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

            {/* 7. Target bulanan, melebar dua kolom. Progress bar datar -
                bukan gauge busur seperti versi sebelumnya. */}
            <BentoCard span={2} className="max-sm:order-7 max-sm:col-span-2">
              <TargetTile kpi={kpi} />
            </BentoCard>
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
      <p className="font-heading mt-auto text-5xl font-normal leading-none tracking-[-0.04em] tabular-nums sm:text-6xl">
        {value === undefined ? "—" : String(value)}
      </p>
    </BentoCard>
  );
}

/**
 * "Target saya": persentase di kanan atas, `selesai/target` di kiri bawah
 * dengan pil hijau, lalu progress bar.
 */
function TargetTile({ kpi }: { kpi: TechnicianKpi | null }) {
  if (!kpi) {
    return (
      <>
        <p className="text-[15px] font-medium">Target saya</p>
        <p className="font-heading mt-auto text-4xl font-normal">—</p>
      </>
    );
  }

  // Cabang tidak mode flat: tidak ada target yang bisa diatur. Jangan menawarkan
  // tautan di sini. Link lama menuju `/app/analitik-servis` memang halaman
  // yang salah (target diatur di `/app/cabang`), dan `/app/cabang` sendiri
  // `roles: MANAGERS` -- teknisi tidak bisa membukanya. Jadi "Atur sekarang"
  // tidak pernah jadi jalan keluar untuk teknisi mana pun.
  if (!kpi.applicable) {
    return (
      <>
        <p className="text-[15px] font-medium">Target saya</p>
        <p className="mt-auto text-sm text-muted-foreground">
          Cabang ini memakai insentif per servis, jadi tidak ada target bulanan.
        </p>
      </>
    );
  }

  if (kpi.unset || kpi.target === null) {
    return (
      <>
        <p className="text-[15px] font-medium">Target saya</p>
        <p className="mt-auto text-sm text-muted-foreground">
          Belum diatur oleh admin cabang ini.
        </p>
      </>
    );
  }

  const percent = kpi.targetPct ?? 0;

  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[15px] font-medium">Target saya</p>
        <p className="font-heading text-sm font-medium tabular-nums">{percent}%</p>
      </div>

      <div className="mt-auto flex flex-wrap items-baseline gap-2">
        <p className="font-heading text-5xl font-normal leading-none tracking-[-0.04em] tabular-nums">
          {kpi.selesai}/{kpi.target}
        </p>
        <span className="rounded-full border border-emerald-600/40 px-2.5 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
          Servis selesai
        </span>
      </div>

      {/* Bar datar, bukan gauge busur. */}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progres target servis bulan ini"
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
      >
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${percent}%` }}
        />
      </div>
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

function DateLine() {
  const label = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
      {label}
    </div>
  );
}
