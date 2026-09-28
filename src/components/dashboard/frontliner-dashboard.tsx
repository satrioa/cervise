"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckIcon,
  CircleIcon,
  ListChecksIcon,
  LockIcon,
  PackageIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  WalletIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { CandyShortcut, CANDY_TONES } from "./candy-shortcut";
import { Button } from "@/components/ui/button";
import { formatCurrencyPlain } from "@/lib/format";
import { AdjustmentDialog } from "@/components/cash/adjustment-dialog";
import { ClosingDialog } from "@/components/cash/closing-dialog";
import { PaymentDialog } from "@/components/cash/payment-dialog";
import {
  checkOpenCashSession,
  getFrontlinerKpi,
  getFrontlinerQueue,
  type CashSessionRow,
  type FrontlinerKpi,
  type FrontlinerQueueItem,
} from "@/app/app/actions/cash";

/**
 * Dashboard frontliner.
 *
 * Kerangka sama dengan `technician-dashboard.tsx` — shell compact dipakai
 * keduanya — tapi isinya berbeda total: kasir bekerja dengan antrean
 * pembayaran dan saldo, teknisi dengan tugas dan target.
 *
 * Kolom kiri berisi tiga daftar operasional. Bukan To-Do pribadi: tabel
 * `cervise_staff_todos` sengaja tidak diberikan ke FRONTLINER.
 */

type QueueGroup = {
  key: "unpaid" | "waiting" | "ready";
  title: string;
  items: FrontlinerQueueItem[];
};

const PROCESS_STATUS = ["Masuk", "Diagnosa", "Menunggu Konfirmasi", "Menunggu Sparepart", "Dikerjakan"];

export function FrontlinerDashboard({ fullName }: { fullName: string | null }) {
  const [queue, setQueue] = useState<FrontlinerQueueItem[]>([]);
  const [kpi, setKpi] = useState<FrontlinerKpi | null>(null);
  const [session, setSession] = useState<CashSessionRow | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [closingOpen, setClosingOpen] = useState(false);
  const [paying, setPaying] = useState<FrontlinerQueueItem | null>(null);

  const reloadQueue = useCallback(() => {
    getFrontlinerQueue().then((result) => {
      if (result.ok) setQueue(result.data);
    });
    getFrontlinerKpi().then((result) => {
      if (result.ok) setKpi(result.data);
    });
  }, []);

  useEffect(() => {
    checkOpenCashSession().then((result) => {
      if (result.ok) setSession(result.data.current);
    });
  }, []);

  useEffect(() => {
    reloadQueue();
  }, [reloadQueue]);

  const groups = buildGroups(queue);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="px-6 py-8 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-5xl">
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
              <p className="mt-2 max-w-xl text-muted-foreground text-sm">
                {queue.length
                  ? `${queue.length} servis menunggu pembayaran.`
                  : "Tidak ada servis menunggu pembayaran."}
              </p>
            </div>
            <Button onClick={() => setClosingOpen(true)} disabled={!session}>
              <LockIcon />
              Tutup Toko
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <CandyShortcut
              label="Servis baru"
              href="/app/servis/baru"
              icon={WrenchIcon}
              tone={CANDY_TONES[0]}
            />
            <CandyShortcut
              label="Penjualan baru"
              href="/app/penjualan"
              icon={ShoppingCartIcon}
              tone={CANDY_TONES[1]}
            />
            <CandyShortcut
              label="Catat Kas"
              icon={WalletIcon}
              tone={CANDY_TONES[2]}
              onClick={() => setAdjustOpen(true)}
            />
            <CandyShortcut
              label="Lihat servis"
              href="/app/servis"
              icon={ListChecksIcon}
              tone={CANDY_TONES[3]}
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-[3fr_2fr]">
            <Card title="Antrean Tugas">
              {groups.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Tidak ada antrean. Semua servis sudah tertangani.
                </p>
              ) : (
                <div className="mt-3 space-y-4">
                  {groups.map((group) => (
                    <QueueList key={group.key} group={group} />
                  ))}
                </div>
              )}
            </Card>

            <Card
              title="Servis Masuk"
              trailing={
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
                  {queue.length} servis
                </span>
              }
            >
              {queue.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Semua sudah dibayar.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-1">
                  {queue.slice(0, 12).map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/app/servis/${item.id}`}
                        className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-foreground/[0.03]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">
                            {item.serviceNumber ?? item.device}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {item.customerName ?? item.device} · {item.status}
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-xs">
                          {formatCurrencyPlain(item.price)}
                        </span>
                        {/* Tombol terpisah supaya tidak memicu navigasi baris. */}
                        <Button size="xs" onClick={() => setPaying(item)}>
                          Bayar
                        </Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FactCard
              label="Servis Masuk"
              icon={PackageIcon}
              value={String(kpi?.masuk ?? 0)}
              sub="Diterima hari ini"
            />
            <FactCard
              label="Diambil"
              icon={CheckIcon}
              value={String(kpi?.diambil ?? 0)}
              sub="Sudah Diambil"
            />
            <FactCard
              label="Batal"
              icon={XIcon}
              value={String(kpi?.batal ?? 0)}
              sub="Dibatalkan"
            />
            <FactCard
              label="Proses Pengerjaan"
              icon={WrenchIcon}
              value={String(kpi?.proses ?? 0)}
              sub="Belum selesai"
            />
          </div>
        </div>
      </div>

      <AdjustmentDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        onSaved={reloadQueue}
      />
      <ClosingDialog
        open={closingOpen}
        onOpenChange={setClosingOpen}
        session={session}
        onClosed={reloadQueue}
      />
      <PaymentDialog
        open={Boolean(paying)}
        onOpenChange={(next) => !next && setPaying(null)}
        service={paying}
        onPaid={reloadQueue}
      />
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

function buildGroups(queue: FrontlinerQueueItem[]): QueueGroup[] {
  const groups: QueueGroup[] = [
    { key: "unpaid", title: "Belum dibayar", items: queue.slice(0, 5) },
    {
      key: "waiting",
      title: "Menunggu pengerjaan",
      items: queue.filter((item) => PROCESS_STATUS.includes(item.status)).slice(0, 3),
    },
    {
      key: "ready",
      title: "Siap diambil",
      items: queue.filter((item) => item.status === "Selesai").slice(0, 3),
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}

function QueueList({ group }: { group: QueueGroup }) {
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
          {group.title}
        </div>
        {group.key !== "unpaid" && (
          <Link
            href="/app/servis"
            className="text-[10px] text-muted-foreground underline underline-offset-2"
          >
            Lihat semua
          </Link>
        )}
      </div>
      <ul className="mt-1.5 flex flex-col">
        {group.items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/app/servis/${item.id}`}
              className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-foreground/[0.03]"
            >
              <CircleIcon className="size-3 shrink-0 text-muted-foreground/50" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{item.serviceNumber ?? item.device}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {item.customerName ?? item.device} · {item.status}
                </div>
              </div>
              <span className="shrink-0 font-mono text-xs">
                {formatCurrencyPlain(item.price)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Card({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
          {title}
        </div>
        {trailing}
      </div>
      {children}
    </section>
  );
}

function FactCard({
  label,
  value,
  sub,
  icon: Icon = TrendingUpIcon,
}: {
  label: string;
  value: string;
  sub: string;
  icon?: typeof TrendingUpIcon;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
          {label}
        </div>
        <Icon className="size-3.5 opacity-40" />
      </div>
      <div className="mt-2 font-heading text-2xl">{value}</div>
      <div className="mt-1 text-muted-foreground text-xs">{sub}</div>
    </div>
  );
}
