"use client";

import { useEffect, useState } from "react";
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
import { TaskNoteCard } from "./task-note-card";
import { toast } from "sonner";
import { getTechnicianDashboardData } from "@/app/app/actions/technician-dashboard";
import type { TechnicianKpi } from "@/lib/operational/technician-dashboard";

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

export function TechnicianDashboard({ fullName }: { fullName: string | null }) {
  const { gridProps } = useBentoStagger(BENTO_STAGGER);

  const [data, setData] = useState<{
    kpi: TechnicianKpi;
    terbaru: { id: string; serviceNumber: string | null; device: string }[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTechnicianDashboardData()
      .then((result) => {
        if (cancelled) return;
        if (result.error) toast.error(result.error);
        setData({
          kpi: result.data.kpi,
          terbaru: result.data.terbaru,
        });
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const kpi = data?.kpi ?? null;

  return (
    // Tinggi proporsional, bukan kunci viewport.
    //
    // Versi lama memakai `h-dvh` + `sm:grid-rows-3`, yang memaksa tiap sel
    // menjadi tepat 1/3 layar: di monitor besar kartu jadi tinggi dan kosong,
    // di laptop jadi gepeng. Sekarang `BENTO_GRID_CLASS` memakai
    // `auto-rows-[minmax(8.5rem,1fr)]` - minimal 8.5rem per baris, maksimal
    // mengisi sisa tinggi yang ada. Layar yang lebih pendek dari minimum
    // boleh menggulir halaman, dan itu lebih baik daripada memampatkan
    // semua kartu.
    <div className="min-h-svh bg-background text-foreground">
      <div className="px-6 py-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-5xl">
          <div>
            <DateLine />
            <h1 className="mt-1 font-heading text-3xl tracking-tight lg:text-4xl">
              {greeting()}, {fullName ?? "Teknisi"}.
            </h1>
          </div>

          {/* `gridProps` memasang `initial`/`animate`; kartu TIDAK memasang
              keduanya, itu syarat agar `staggerChildren` benar-benar sampai
              ke setiap kartu. */}
          <motion.div {...gridProps} className={BENTO_GRID_CLASS}>
            {/* 1. Kartu aksi - permukaannya sendiri yang candy, bukan kartu
                abu-abu yang memuat tombol di dalam. */}
            <BentoCard candy="accent" href="/app/servis/baru" title="Servis baru">
              <BentoMenuItem icon={WrenchIcon} label="Servis baru" />
            </BentoCard>

            {/* 2. Kartu aksi. Biru, bukan pink brand: tanpa perbedaan warna
                ini dua kartu aksi teknisi sama persis dan pink mendominasi
                dashboard. */}
            <BentoCard candy="blue" href="/app/inventori" title="Data Sparepart">
              <BentoMenuItem icon={BoxIcon} label="Sparepart" />
            </BentoCard>

            {/* 3. Angka masuk hari ini. */}
            <StatTile label="Servis Masuk Hari ini" value={kpi?.masukHariIni} />

            {/* 4. Daftar servis terbaru, dua baris - halaman detail servis
                adalah tempat pembayaran, jadi barisnya cuma membuka detail. */}
            <BentoCard rowSpan={2} className="overflow-hidden">
              <CardTitle>Servis terbaru</CardTitle>
              <TerbaruList items={data?.terbaru} />
            </BentoCard>

            {/* 5. To-Do, dua kolom kali dua baris. */}
            <BentoCard span={2} rowSpan={2} className="overflow-visible">
              <TaskNoteCard compact compactLimit={5} />
            </BentoCard>

            {/* 6. Angka selesai hari ini. */}
            <StatTile label="Servis Selesai Hari ini" value={kpi?.selesaiHariIni} />

            {/* 7. Target bulanan, melebar dua kolom. Progress bar datar -
                bukan gauge busur seperti versi sebelumnya. */}
            <BentoCard span={2}>
              <TargetTile kpi={kpi} />
            </BentoCard>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Isi sel
// ---------------------------------------------------------------------------

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-medium tracking-tight">{children}</h2>;
}

/** Kartu angka: label di atas, angka besar di bawah. */
function StatTile({ label, value }: { label: string; value: number | undefined }) {
  return (
    <BentoCard>
      <p className="text-sm">{label}</p>
      <p className="font-heading mt-auto text-5xl font-semibold leading-none tracking-tight">
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
        <p className="text-sm">Target saya</p>
        <p className="font-heading mt-auto text-3xl font-semibold">—</p>
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
        <p className="text-sm">Target saya</p>
        <p className="mt-auto text-sm text-muted-foreground">
          Cabang ini memakai insentif per servis, jadi tidak ada target bulanan.
        </p>
      </>
    );
  }

  if (kpi.unset || kpi.target === null) {
    return (
      <>
        <p className="text-sm">Target saya</p>
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
        <p className="text-sm">Target saya</p>
        <p className="font-heading text-sm font-semibold tabular-nums">{percent}%</p>
      </div>

      <div className="mt-auto flex flex-wrap items-baseline gap-2">
        <p className="font-heading text-4xl font-semibold leading-none tracking-tight tabular-nums">
          {kpi.selesai}/{kpi.target}
        </p>
        <span className="rounded-full border border-emerald-600/40 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
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
  items: { id: string; serviceNumber: string | null; device: string }[] | undefined;
}) {
  if (!items) {
    return <p className="mt-2 text-sm opacity-60">Memuat...</p>;
  }
  if (items.length === 0) {
    return <p className="mt-2 text-sm opacity-60">Belum ada servis.</p>;
  }

  return (
    // `overflow-y-auto` + `min-h-0`: daftar yang melebihi tinggi sel
    // menggulir di dalam kartu. Tanpa itu, `h-dvh` di luar membuat baris
    // meluber dan halaman ikut ter-scroll.
    <ul className="-mx-1 mt-1 flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-none">
      {items.map((item) => (
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
