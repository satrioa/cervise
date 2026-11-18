"use client";

import { useState } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  ReceiptTextIcon,
  StoreIcon,
  Trash2Icon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListRowsSkeleton } from "@/components/ui/skeleton-shapes";
import { formatCurrencyPlain } from "@/lib/format";
import type { DashboardFeedItem } from "@/lib/operational/dashboard";
import { cn } from "@/lib/utils";

type FeedFilter = "semua" | "servis" | "transaksi" | "aktivitas";
type ActivityFilter = "semua" | "edit" | "hapus" | "tambah" | "toko";

const ACTIVITY_ACTIONS: Record<Exclude<ActivityFilter, "semua">, string[]> = {
  edit: ["edit_field"],
  hapus: ["delete"],
  tambah: ["create"],
  toko: ["session_open", "session_close"],
};

const ACTIVITY_LABEL: Record<ActivityFilter, string> = {
  semua: "Semua",
  edit: "Edit",
  hapus: "Hapus",
  tambah: "Tambah",
  toko: "Buka-tutup Toko",
};

const FEED_VISIBLE_LIMIT = 20;

function matchesFeedFilter(item: DashboardFeedItem, filter: FeedFilter, activity: ActivityFilter): boolean {
  if (filter === "servis") return item.kind === "service";
  if (filter === "transaksi") return item.kind === "transaction";
  if (filter === "aktivitas") {
    if (activity === "semua") {
      return item.kind === "activity" || ACTIVITY_ACTIONS.tambah.includes(item.action);
    }
    return ACTIVITY_ACTIONS[activity].includes(item.action);
  }
  return true;
}

function localDayKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function feedAppearance(item: DashboardFeedItem): { Icon: LucideIcon; className: string } {
  if (item.kind === "transaction") {
    return { Icon: ReceiptTextIcon, className: "bg-blue-500/12 text-blue-600 dark:text-blue-400" };
  }
  if (item.kind === "service") {
    return { Icon: WrenchIcon, className: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" };
  }
  if (item.action === "delete") {
    return { Icon: Trash2Icon, className: "bg-rose-500/12 text-rose-600 dark:text-rose-400" };
  }
  if (item.action === "edit_field") {
    return { Icon: PencilIcon, className: "bg-amber-500/12 text-amber-600 dark:text-amber-400" };
  }
  return { Icon: StoreIcon, className: "bg-violet-500/12 text-violet-600 dark:text-violet-400" };
}

export default function ActivityCard({
  items,
  loading,
  className,
}: {
  items: DashboardFeedItem[];
  loading: boolean;
  className?: string;
}) {
  const [filter, setFilter] = useState<FeedFilter>("semua");
  const [activity, setActivity] = useState<ActivityFilter>("semua");
  const [dayOffset, setDayOffset] = useState<0 | -1>(0);

  const selectedDay = new Date();
  selectedDay.setDate(selectedDay.getDate() + dayOffset);
  const selectedDayKey = localDayKey(selectedDay);
  const filtered = items
    .filter(
      (item) =>
        matchesFeedFilter(item, filter, activity) && localDayKey(item.createdAt) === selectedDayKey,
    )
    .slice(0, FEED_VISIBLE_LIMIT);
  const dayLabel = dayOffset === 0 ? "Hari ini" : "Kemarin";

  return (
    <div className={cn("flex flex-col rounded-xl border border-border/60 bg-background/40 p-5 lg:h-[22rem]", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Recent activity</div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setDayOffset(-1)}
            disabled={dayOffset === -1}
            aria-label="Hari sebelumnya"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeftIcon className="size-3.5" />
          </button>
          <span className="min-w-14 text-center font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {dayLabel}
          </span>
          <button
            type="button"
            onClick={() => setDayOffset(0)}
            disabled={dayOffset === 0}
            aria-label="Hari berikutnya"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRightIcon className="size-3.5" />
          </button>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as FeedFilter)} className="mt-3">
        <TabsList className="w-full">
          <TabsTrigger value="semua" className="px-1.5 text-xs">Semua</TabsTrigger>
          <TabsTrigger value="servis" className="px-1.5 text-xs">Servis</TabsTrigger>
          <TabsTrigger value="transaksi" className="px-1.5 text-xs">Transaksi</TabsTrigger>
          <TabsTrigger value="aktivitas" className="px-1.5 text-xs">Aktivitas</TabsTrigger>
        </TabsList>
      </Tabs>

      {filter === "aktivitas" ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {(Object.keys(ACTIVITY_LABEL) as ActivityFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setActivity(option)}
              className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors ${
                activity === option
                  ? "bg-foreground/[0.08] text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ACTIVITY_LABEL[option]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 max-h-[18rem] min-h-0 flex-1 overflow-y-auto pr-1 lg:max-h-none">
        {loading ? (
          <ListRowsSkeleton rows={4} leading="icon" lines={2} />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada aktivitas {dayOffset === 0 ? "hari ini" : "kemarin"}
          </p>
        ) : (
          <Tooltip.Provider>
            <ul className="flex flex-col gap-3.5">
              {filtered.map((item) => {
                const { Icon, className: iconClass } = feedAppearance(item);
                return (
                  <li key={item.id}>
                    <Tooltip.Root>
                      <Tooltip.Trigger
                        render={
                          <div
                            tabIndex={0}
                            className="flex items-start gap-3 rounded-md text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        }
                      >
                        <span
                          className={`mt-1 flex size-6 shrink-0 items-center justify-center rounded-full ${iconClass}`}
                        >
                          <Icon className="size-3.5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1 leading-snug">
                          <div className="flex items-baseline gap-1.5">
                            <span className="truncate font-medium">{item.title}</span>
                            <span className="shrink-0 rounded bg-foreground/[0.06] px-1 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                              {item.actionLabel}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">{item.detail}</div>
                          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                            {new Date(item.createdAt).toLocaleDateString("id-ID")}
                          </div>
                        </div>
                        {item.amount !== null ? (
                          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                            {formatCurrencyPlain(item.amount)}
                          </span>
                        ) : null}
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Positioner sideOffset={8} className="z-50">
                          <Tooltip.Popup className="w-72 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-md">
                            <div className="font-medium">
                              {item.actionLabel} · {item.title}
                            </div>
                            <div className="mt-1 text-muted-foreground">{item.detail}</div>
                            <div className="mt-2 grid gap-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                              {item.serviceId ? <span>Servis {item.serviceId.slice(0, 8).toUpperCase()}</span> : null}
                              {item.device ? <span>Perangkat {item.device}</span> : null}
                              <span>Oleh {item.actor}</span>
                              <span>{new Date(item.createdAt).toLocaleString("id-ID")}</span>
                            </div>
                          </Tooltip.Popup>
                        </Tooltip.Positioner>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </li>
                );
              })}
            </ul>
          </Tooltip.Provider>
        )}
      </div>
    </div>
  );
}
