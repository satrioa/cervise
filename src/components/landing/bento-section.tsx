"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Globe2,
  LayoutDashboard,
  Wrench,
  Package,
  Wallet,
  Activity,
  TrendingUp,
  CheckCircle2,
  Bell,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { CobeGlobe } from "@/components/cobe-globe";
import CardSwap, { Card } from "@/components/ui/CardSwap";
import { KanbanPreview } from "./kanban-preview";
import { ServisMock, InventoryMock, PosMock, LaporanMock } from "./card-preview-mocks";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/* A reusable mock "screenshot" surface */
function MockScreen({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
        <span className="size-2 rounded-full bg-white/20" />
        <span className="size-2 rounded-full bg-white/20" />
        <span className="ml-2 text-[10px] text-muted-foreground">{label}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

const fadeIn = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: 0.05 * i, ease: EASE },
  }),
};

const NOTIFICATIONS = [
  { icon: "🔧", t: "Servis #SV-2406 — iPhone 15 Pro dipindahkan ke Perbaikan", s: "Baru saja" },
  { icon: "💳", t: "Pembayaran #INV-2401 — Rp 4.250.000 diterima via QRIS", s: "5 menit lalu" },
  { icon: "📦", t: "Stok masuk: LCD Samsung S24 (5 pcs) ditambahkan", s: "15 menit lalu" },
  { icon: "🛒", t: "Checkout POS #POS-2401 — Rp 850.000 (3 item)", s: "30 menit lalu" },
  { icon: "👤", t: "Teknisi Baru: Andi Pratama ditambahkan ke cabang", s: "1 jam lalu" },
  { icon: "🔧", t: "Servis #SV-2405 — MacBook Air M2 selesai, siap diambil", s: "2 jam lalu" },
  { icon: "⚠️", t: "Stok baterai iPhone 13 hampir habis (sisa 2)", s: "3 jam lalu" },
  { icon: "🔄", t: "Shift pagi dibuka — Kas awal Rp 1.000.000", s: "4 jam lalu" },
  { icon: "📊", t: "Laporan: 12 servis, Rp 8.2jt revenue hari ini", s: "5 jam lalu" },
  { icon: "✅", t: "Shift ditutup — Kas fisik Rp 550.000 (selisih +Rp 5.000)", s: "Kemarin" },
];

function NotificationStack({ cycle }: { cycle: number }) {
  const ref = React.useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className="relative mt-4 flex-1" style={{ minHeight: 280 }}>
      {NOTIFICATIONS.map((n, i) => {
        const stackIdx = (i - (cycle % NOTIFICATIONS.length) + NOTIFICATIONS.length) % NOTIFICATIONS.length;
        const isTop = stackIdx === 0;
        const offset = Math.min(stackIdx, 4);
        const scale = Math.max(1 - offset * 0.035, 0.72);
        const translateY = offset * 42;
        const translateX = offset * 0;

        return (
          <motion.div
            key={n.t}
            initial={false}
            animate={{
              scale,
              y: translateY,
              x: translateX,
              opacity: offset > 6 ? Math.max(1 - (offset - 6) * 0.25, 0) : 1,
              zIndex: 20 - offset,
            }}
            transition={{ duration: 0.5, ease: EASE }}
            className={cn(
              "absolute left-0 right-0 rounded-lg border px-3 py-2.5 backdrop-blur-sm",
              isTop
                ? "border px-3 py-2.5 backdrop-blur-xl shadow-lg shadow-primary/12"
                : "border-white/[0.01] bg-white/[0.01]",
            )}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0 text-xs">{n.icon}</span>
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "truncate text-xs",
                  isTop ? "text-foreground font-medium" : "text-muted-foreground",
                )}>
                  {n.t}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground/60">{n.s}</p>
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* Fade at bottom — more items below */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background via-background/60 to-transparent" />
    </div>
  );
}

export function BentoSection() {
  const [cycle, setCycle] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => setCycle((c) => c + 1), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <motion.span
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
          >
            Fitur Unggulan
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Satu platform untuk seluruh operasional toko
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-muted-foreground"
          >
            Dari intake hingga laporan keuangan — semua terhubung, realtime, dan mobile-friendly.
          </motion.p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Card 1: Globe */}
          <motion.div
            variants={fadeIn}
            custom={0}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-6 md:col-span-1"
          >
            <div className="flex items-center gap-2 text-primary">
              
              <h3 className="text-lg font-semibold text-foreground">Pantau dari Mana Saja</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Kelola seluruh cabang secara realtime dimanapun Anda berada.
            </p>
            <div className="relative -mx-6 -mb-6" style={{ height: 175 }}>
              <div className="absolute left-1/2 bottom-0 w-[420px] -translate-x-1/2 translate-y-1/2">
                <CobeGlobe className="w-full" />
              </div>
            </div>
            <div className="absolute -right-10 -top-10 size-40 rounded-full bg-secondary/24 blur-3xl transition-opacity duration-500 group-hover:opacity-100 opacity-40" />
          </motion.div>

          {/* Card 2: CardSwap - Dashboard Features */}
          <motion.div
            variants={fadeIn}
            custom={1}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 md:col-span-2"
          >
            <div className="flex h-full flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative z-10 flex-1 space-y-2 py-4 sm:max-w-[46%]">
                <div className="space-y-5">
                  <FeatureTitle className="text-3xl">
                    Semua dalam satu Aplikasi
                  </FeatureTitle>
                  <FeatureDescription>
                    Kelola dan pantau seluruh operasional toko dengan mudah lewat satu antarmuka yang sederhana.
                  </FeatureDescription>
                </div>
              </div>

              <div className="relative h-[240px] w-full shrink-0 sm:w-[420px]">
                <CardSwap
                  width={420}
                  height={240}
                  cardDistance={40}
                  verticalDistance={35}
                  delay={4000}
                  pauseOnHover={true}
                  skewAmount={4}
                  easing="elastic"
                >
                  <Card customClass="border-white/[0.08] overflow-hidden rounded-xl">
                    <ServisMock />
                  </Card>

                  <Card customClass="border-white/[0.08] overflow-hidden rounded-xl">
                    <InventoryMock />
                  </Card>

                  <Card customClass="border-white/[0.08] overflow-hidden rounded-xl">
                    <PosMock />
                  </Card>

                  <Card customClass="border-white/[0.08] overflow-hidden rounded-xl">
                    <LaporanMock />
                  </Card>
                </CardSwap>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Track Progress Servis — Kanban */}
          <motion.div
            variants={fadeIn}
            custom={2}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 h-[260px]"
          >
            <div className="flex items-center gap-2 text-primary">
              <Activity className="size-5" />
              <h3 className="text-lg font-semibold text-foreground">Track Progress Servis</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Pantau setiap unit dari intake hingga pickup dengan status realtime.
            </p>
            <KanbanPreview />
          </motion.div>

          {/* Card 4: Performa Toko */}
          <motion.div
            variants={fadeIn}
            custom={3}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-primary/10 to-transparent p-6 h-[260px]"
          >
            <div className="flex items-center gap-2 text-primary">
              <TrendingUp className="size-5" />
              <h3 className="text-lg font-semibold text-foreground">Performa Toko</h3>
            </div>
            
            <p className="mt-2 text-sm text-muted-foreground">
              Analitik cabang, teknisi, dan revenue dalam satu pandangan.
            </p>
            
            <div className="mt-4 h-45 -mx-6 -mb-6 overflow-visible">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[
                    { day: "Sen", revenue: 45 },
                    { day: "Sel", revenue: 62 },
                    { day: "Rab", revenue: 58 },
                    { day: "Kam", revenue: 80 },
                    { day: "Jum", revenue: 75 },
                    { day: "Sab", revenue: 95 },
                    { day: "Min", revenue: 100 },
                  ]}
                  margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={true}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis hide domain={[0, 100]} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorRevenue)"
                    animationDuration={1500}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Card 5: Notifikasi */}
          <motion.div
            variants={fadeIn}
            custom={4}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-xl h-[260px]",
              "bg-background dark:bg-background transform-gpu",
              "dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset] dark:[border:1px_solid_rgba(255,255,255,.1)]",
            )}
          >
            <div className="relative z-10 flex flex-1 flex-col p-4">
              <div className="flex flex-col gap-1">
                
                <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300">
                  Selalu Update
                </h3>
                <p className="max-w-lg text-sm text-neutral-400">
                  Ketahui semua aktifitas toko langsung.
                </p>
              </div>

              <NotificationStack cycle={cycle} />
            </div>

            <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-black/3 group-hover:dark:bg-neutral-800/10" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
function FeatureTitle({ className, ...props }: React.ComponentProps<"h3">) {
	return (
		<h3
			className={cn("font-medium text-foreground text-lg", className)}
			{...props}
		/>
	);
}
function FeatureDescription({
	className,
	...props
}: React.ComponentProps<"p">) {
	return (
		<p className={cn("text-muted-foreground text-sm", className)} {...props} />
	);
}
export default BentoSection;
