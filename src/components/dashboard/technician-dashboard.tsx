"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  CircleIcon,
  PlusIcon,
  TargetIcon,
  TrendingUpIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  attentionReasonLabel,
  type AttentionItem,
} from "@/lib/operational/technician-dashboard";
import { getTechnicianDashboardData } from "@/app/app/actions/technician-dashboard";
import {
  createTodo,
  deleteTodo,
  getMyTodos,
  toggleTodo,
  updateTodo,
  type StaffTodo,
} from "@/app/app/actions/todos";

/**
 * Dashboard teknisi.
 *
 * Kerangka mengikuti referensi `dashboards/home.json`: tanggal mono, sapaan,
 * deretan shortcut, grid 3fr/2fr (To-Do | antrean), lalu tiga kartu angka.
 * `Card` dan `FactCard` di bawah adalah komponen lokal, bukan
 * `src/components/ui/card.tsx` — header-nya `font-mono uppercase`, bukan
 * `CardHeader` bawaan, dan itu yang membuat tampilan sesuai desain.
 */

const SHORTCUTS = [
  { label: "Servis baru", href: "/app/servis/baru" },
  { label: "Antrean saya", href: "/app/servis" },
  { label: "Input stok", href: "/app/inventori" },
  { label: "Target saya", href: "/app/analitik-servis" },
];

export function TechnicianDashboard({ fullName }: { fullName: string | null }) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="px-6 py-8 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-5xl">
          <DateLine />
          <h1 className="mt-1 font-heading text-3xl tracking-tight lg:text-4xl">
            {greeting()}, {fullName ?? "Teknisi"}.
          </h1>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SHORTCUTS.map((s) => (
              <ShortcutButton key={s.href} {...s} />
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-[3fr_2fr]">
            <TodoCard />
            <AttentionCard />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCards />
          </div>
        </div>
      </div>
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

function DateLine() {
  const label = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">{label}</div>
  );
}

function ShortcutButton({ label, href }: { label: string; href: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = href;
      }}
      className="group flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-3.5 py-2.5 text-left transition-colors hover:border-foreground/40 hover:bg-background/60"
    >
      <span className="text-sm">{label}</span>
      <ArrowRightIcon className="size-3.5 opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:opacity-90" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Kartu
// ---------------------------------------------------------------------------

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
  icon: Icon = CalendarIcon,
  action,
}: {
  label: string;
  value: string;
  sub: string;
  icon?: typeof CalendarIcon;
  action?: { label: string; href: string };
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
      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{sub}</span>
        {action ? (
          <Link href={action.href} className="shrink-0 underline underline-offset-2">
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// To-Do personal
// ---------------------------------------------------------------------------

function TodoCard() {
  // `todos` null berarti belum termuat. Dipisah dari `loading` supaya
  // penanganannya tetap bertipe `StaffTodo[]` dan tidak perlu narrowing
  // di setiap pembaruan optimistik.
  const [todos, setTodos] = useState<StaffTodo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [due, setDue] = useState("");
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const loading = !loaded;

  useEffect(() => {
    let cancelled = false;
    getMyTodos()
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setTodos(result.data);
        else toast.error(result.error);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submitDraft = async () => {
    const title = draft.trim();
    if (!title) return;
    const result = await createTodo({ title, dueAt: due ? new Date(due).toISOString() : null });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setTodos((prev) => [result.data, ...prev]);
    setDraft("");
    setDue("");
    setComposing(false);
  };

  const onToggle = async (todo: StaffTodo) => {
    // Optimistic: centang terasa instan, dan di-rollback kalau server menolak.
    const nextDone = todo.doneAt === null;
    const previous = todos;
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id ? { ...t, doneAt: nextDone ? "pending" : null } : t,
      ),
    );
    const result = await toggleTodo({ id: todo.id, done: nextDone });
    if (!result.ok) {
      setTodos(previous);
      toast.error(result.error);
      return;
    }
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, doneAt: result.data.doneAt } : t)));
  };

  const onDelete = async (todo: StaffTodo) => {
    const previous = todos;
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    const result = await deleteTodo({ id: todo.id });
    if (!result.ok) {
      setTodos(previous);
      toast.error(result.error);
    }
  };

  const onRename = async (todo: StaffTodo, title: string) => {
    if (title.trim() === todo.title) {
      setEditing(null);
      return;
    }
    const result = await updateTodo({ id: todo.id, title });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? result.data : t)));
    setEditing(null);
  };

  const open = todos.filter((t) => t.doneAt === null);
  const done = todos.filter((t) => t.doneAt !== null);
  const ordered = [...open, ...done];

  return (
    <Card
      title="Tugas Saya"
      trailing={
        <Button variant="ghost" size="sm" onClick={() => setComposing((v) => !v)}>
          <PlusIcon />
          Baru
        </Button>
      }
    >
      {composing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitDraft();
              if (e.key === "Escape") setComposing(false);
            }}
            placeholder="Contoh: Cek IMEI modul kamera"
            className="h-8 min-w-0 flex-1"
          />
          <Input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="h-8 w-36"
            aria-label="Tenggat"
          />
          <Button size="sm" className="h-8" onClick={submitDraft}>
            Simpan
          </Button>
          <Button variant="ghost" size="icon-sm" className="h-8" onClick={() => setComposing(false)}>
            <XIcon />
          </Button>
        </div>
      ) : null}

      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Memuat tugas...</p>
      ) : ordered.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Belum ada tugas. Klik <span className="font-medium">Baru</span> untuk menambah.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {ordered.map((todo) => {
            const isDone = todo.doneAt !== null;
            return (
              <li
                key={todo.id}
                className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-foreground/[0.03]"
              >
                <button
                  type="button"
                  onClick={() => onToggle(todo)}
                  aria-label={isDone ? "Tandai belum selesai" : "Tandai selesai"}
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    isDone
                      ? "border-foreground/30 bg-foreground/10 text-foreground"
                      : "border-foreground/30 text-transparent hover:bg-foreground/[0.06]",
                  )}
                >
                  {isDone ? <CheckIcon className="size-3" /> : <CircleIcon className="size-3" />}
                </button>

                {editing === todo.id ? (
                  <Input
                    autoFocus
                    defaultValue={todo.title}
                    onBlur={(e) => onRename(todo, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="h-7 flex-1 text-sm"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing(todo.id)}
                    className={cn(
                      "min-w-0 flex-1 truncate text-left text-sm",
                      isDone && "text-muted-foreground line-through",
                    )}
                  >
                    {todo.title}
                  </button>
                )}

                <span className="w-20 shrink-0 text-right font-mono text-[10px] text-muted-foreground/70 uppercase tracking-[0.2em]">
                  {dueLabel(todo.dueAt)}
                </span>

                <button
                  type="button"
                  onClick={() => onDelete(todo)}
                  aria-label="Hapus tugas"
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <XIcon className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function dueLabel(dueAt: string | null): string {
  if (!dueAt) return "—";
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "—";
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const days = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86_400_000);
  if (days < 0) return "Lewat";
  if (days === 0) return "Hari ini";
  if (days === 1) return "Besok";
  return due.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// Antrean butuh perhatian
// ---------------------------------------------------------------------------

function AttentionCard() {
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTechnicianDashboardData()
      .then((result) => {
        if (cancelled) return;
        if (result.error) toast.error(result.error);
        setItems(result.data.attention);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card
      title="Servis Butuh Perhatian"
      trailing={
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
          {loading ? "..." : `${items.length} servis`}
        </span>
      }
    >
      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Memuat antrean...</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Tidak ada servis yang butuh perhatian.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/app/servis/${item.id}`}
                className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-foreground/[0.03]"
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    item.priority === "tinggi" ? "bg-amber-500" : "bg-sky-500",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    {item.serviceNumber ?? item.device}
                    {item.serviceNumber ? ` · ${item.device}` : ""}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {attentionReasonLabel(item.reason)}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-[0.2em]">
                  {item.waitingLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// KPI
// ---------------------------------------------------------------------------

function KpiCards() {
  const [kpi, setKpi] = useState<{ target: number | null; selesai: number; targetPct: number | null; unset: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTechnicianDashboardData()
      .then((result) => {
        if (!cancelled) setKpi(result.data.kpi);
      })
      .catch(() => {
        if (!cancelled) setKpi(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!kpi) {
    return <FactCard label="Target" value="—" sub="Memuat..." icon={TargetIcon} />;
  }

  return (
    <>
      <FactCard
        label="Target"
        icon={TargetIcon}
        value={kpi.unset ? "Belum diatur" : `${kpi.selesai} / ${kpi.target}`}
        sub={
          kpi.unset
            ? "Master Admin belum menetapkan target"
            : `${kpi.targetPct}% dari target bulan ini`
        }
        action={kpi.unset ? { label: "Atur", href: "/app/analitik-servis" } : undefined}
      />
      <FactCard
        label="Selesai bulan ini"
        icon={TrendingUpIcon}
        value={String(kpi.selesai)}
        sub="Servis Selesai atau Sudah Diambil"
      />
      <FactCard
        label="Antrean"
        icon={WrenchIcon}
        value="—"
        sub="Buka tab Servis untuk antrean lengkap"
        action={{ label: "Buka", href: "/app/servis" }}
      />
    </>
  );
}
