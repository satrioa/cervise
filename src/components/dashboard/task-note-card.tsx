"use client";

import { useEffect, useState } from "react";
import { CheckIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react";
import { MentionComposerInput, NoteWithMentions, type ChipSource } from "./mention-composer-input";
import { addTodoMentions, getTodoMentions, type TodoMention } from "@/app/app/actions/todo-mentions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createTodo,
  deleteTodo,
  getMyTodos,
  toggleTodo,
  updateTodo,
  type StaffTodo,
} from "@/app/app/actions/todos";

/**
 * Kartu catatan tugas pribadi.
 *
 * Dipakai bersama oleh dashboard teknisi dan frontliner. Semula hanya ada di
 * technician-dashboard.tsx, tapi tabel `cervise_staff_todos` tidak membatasi
 * per role - policy-nya hanya `employee_id = auth.uid()` plus
 * can_access_tenant_branch. Jadi frontliner sejak awal sebenarnya bisa memakai
 * tabel ini; yang menahan cuma keputusan tampilan di dashboard frontliner.
 *
 * Diekstrak ke sini supaya satu Improvement tidak doitong dua kali: kalau
 * To-Do masih disalin per dashboard, perbaikan berikutnya hanya berlaku untuk
 * satu role dan yang lain diam-diam tertinggal.
 *
 * Tiga varian tampilan, satu sumber state/aksi:
 * - `default`: kartu mandiri (dipakai di luar bento bila perlu).
 * - `bento`: satu kartu putih utuh, mengisi sel 2x2 dashboard teknisi.
 *   Ringkasan count dan daftar tugas tidak lagi dipisah menjadi dua panel.
 * - `compact`: satu kartu ringkas untuk sel 1x1 dashboard frontliner.
 */

export function Card({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-black/5 bg-background/40 p-4 dark:border-white/10">
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

// ---------------------------------------------------------------------------
// To-Do personal
// ---------------------------------------------------------------------------

/** Mention di dalam composer, lengkap dengan label untuk chip. */
type DraftMention = ChipSource;
/**
 * Bawaannya SEMUA tugas tampil dan daftarnya menggulir di dalam sel bento, jadi
 * tidak ada tugas yang "hilang" hanya karena selnya kecil. `compactLimit`
 * hanya dipakai kalau pemanggil memang ingin memangkas daftar dan memindahkan
 * sisanya ke popover "Lihat semua" (mis. sel 2x2 teknisi).
 */
export type TaskNoteCardProps = {
  /**
   * Berapa tugas yang tampil sebelum sisanya pindah ke popover. Kosongkan
   * untuk menampilkan seluruh daftar.
   */
  compactLimit?: number;
  /**
   * Bentuk permukaan. `bento` untuk sel 2x2 teknisi, `compact` untuk sel 1x1
   * frontliner, `default` untuk kartu mandiri.
   */
  variant?: "default" | "bento" | "compact";
  /**
   * Tugas yang sudah dimuat server. Bila diberikan, kartu tidak meminta daftar
   * ulang saat mount - datanya sudah ada di HTML pertama.
   */
  initialTodos?: StaffTodo[];
  /** Mention untuk `initialTodos`, juga dari server. */
  initialMentions?: TodoMention[];
};

/** Kelompokkan mention per catatan supaya baris tinggal mencari id-nya. */
function groupMentions(mentions: TodoMention[]): Record<string, TodoMention[]> {
  const grouped: Record<string, TodoMention[]> = {};
  for (const mention of mentions) {
    (grouped[mention.todoId] ??= []).push(mention);
  }
  return grouped;
}

export function TaskNoteCard({
  compactLimit,
  variant = "default",
  initialTodos,
  initialMentions,
}: TaskNoteCardProps = {}) {
  // `todos` null berarti belum termuat. Dipisah dari `loading` supaya
  // penanganannya tetap bertipe `StaffTodo[]` dan tidak perlu narrowing
  // di setiap pembaruan optimistik.
  const [todos, setTodos] = useState<StaffTodo[]>(initialTodos ?? []);
  const [loaded, setLoaded] = useState(initialTodos !== undefined);
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  // Mention yang dipilih tapi belum disimpan. Dipisah dari `mentionsByTodo`
  // supaya membatalkan composer tidak mengubah catatan yang sudah tersimpan.
  //
  // Chip di dalam editor perlu `label` untuk dirender, tapi `MentionInput` yang
  // dikirim ke server hanya punya kind/id/token. `draftMentions` menyimpan
  // bentuk yang lebih lengkap dan dipersempit saat disimpan -- kalau label ikut
  // dikirim ke server, ada dua sumber kebenaran untuk teks chip.
  const [draftMentions, setDraftMentions] = useState<DraftMention[]>([]);
  // Nilai judul yang sedang diedit inline. Terpisah dari `draft` supaya
  // membuka edit tidak menimpa apa yang diketik di composer yang belum
  // disimpan.
  const [editDraft, setEditDraft] = useState("");
  const [mentionsByTodo, setMentionsByTodo] = useState<Record<string, TodoMention[]>>(() =>
    groupMentions(initialMentions ?? []),
  );

  const loading = !loaded;

  useEffect(() => {
    // Data awal sudah dari server. Meminta ulang di sini hanya menambah satu
    // round-trip sebelum kartu bisa dipakai.
    if (initialTodos !== undefined) return;

    let cancelled = false;
    getMyTodos()
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setTodos(result.data);
        // Mention dimuat terpisah dan setelah daftar tugas, supaya satu
        // catatan tanpa mention tidak membuat seluruh daftar gagal tampil.
        if (result.data.length === 0) return;
        getTodoMentions(result.data.map((t) => t.id)).then((m) => {
          if (cancelled) return;
          if (!m.ok) {
            toast.error(m.error);
            return;
          }
          setMentionsByTodo(groupMentions(m.data));
        });
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initialTodos]);

  const submitDraft = async () => {
    const title = draft.trim();
    if (!title) return;
    // To-Do cukup teks. Kolom tenggat tetap ada di database untuk catatan
    // lama, tapi catatan baru selalu tanpa tanggal.
    const result = await createTodo({ title, dueAt: null });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setTodos((prev) => [result.data, ...prev]);
    setDraft("");
    setDraftMentions([]);
    setComposing(false);

    // Mention disimpan setelah task-nya ada, karena `todo_id`-nya harus
    // sudah benar. Kalau gagal, task tetap tampil -- catatan tanpa
    // reference lebih baik daripada task yang hilang.
    //
    // Yang dikirim hanya kind/id/token. `label` sengaja dibuang: yang
    // ditampilkan di server dibaca ulang dari tabel tujuan, jadi menyimpan
    // label berarti dua sumber kebenaran untuk teks chip.
    if (draftMentions.length > 0) {
      const added = await addTodoMentions({
        todoId: result.data.id,
        mentions: draftMentions.map((m) => ({ kind: m.kind, id: m.id, token: m.token })),
      });
      if (!added.ok) {
        toast.error(`Tugas tersimpan, tapi mention gagal: ${added.error}`);
        return;
      }
      const loaded = await getTodoMentions([result.data.id]);
      if (loaded.ok) setMentionsByTodo((prev) => ({ ...prev, [result.data.id]: loaded.data }));
    }
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
    // Mention ikut hilang dari state: cascade di database sudah membersihkannya,
    // jadi membiarkannya akan menampilkan chip untuk catatan yang sudah hilang.
    setMentionsByTodo((prev) => {
      const next = { ...prev };
      delete next[todo.id];
      return next;
    });
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
  // Hanya pangkas kalau pemanggil meminta batas eksplisit. Bawaannya seluruh
  // daftar tampil: dulu sel 1x1 frontliner memaksa satu baris, jadi 8 dari 9
  // tugas hanya terlihat setelah membuka popover "Lihat semua".
  const visible =
    compactLimit != null ? ordered.slice(0, compactLimit) : ordered;
  const hiddenCount = ordered.length - visible.length;
  const doneLabel = loading ? "—" : `${done.length}/${todos.length}`;

  const composer = composing ? (
    <div className="flex shrink-0 flex-col gap-2 pb-2">
      <MentionComposerInput
        value={draft}
        onChange={setDraft}
        mentions={draftMentions}
        onMentionsChange={setDraftMentions}
        onEnter={() => void submitDraft()}
        onEscape={() => {
          setComposing(false);
          setDraft("");
          setDraftMentions([]);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="h-8" onClick={submitDraft}>
          Simpan
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-8"
          onClick={() => {
            setComposing(false);
            setDraft("");
            setDraftMentions([]);
          }}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  ) : null;

  const listBody = loading ? (
    <div className="flex flex-1 flex-col gap-1.5 py-1">
      <Skeleton className="h-7 rounded-lg" />
      <Skeleton className="h-7 rounded-lg" />
      <Skeleton className="h-7 rounded-lg" />
    </div>
  ) : ordered.length === 0 ? (
    <p className="flex flex-1 items-center justify-center px-2 text-center text-xs text-muted-foreground">
      Belum ada tugas.
    </p>
  ) : (
    <>
      <ul
        className={cn(
          // `divide-y` memisahkan tiap tugas. Barisnya sendiri tetap
          // transparan, jadi garis tipis ini yang jadi pemisah visual -
          // bukan latar abu-abu per baris yang membuat daftar terlihat berat.
          "flex min-h-0 flex-1 flex-col divide-y divide-black/5 overflow-y-auto scrollbar-none dark:divide-white/10",
          variant === "default" ? "mt-3" : "mt-1",
        )}
      >
        {visible.map((todo) => {
          const isDone = todo.doneAt !== null;
          const isEditing = editing === todo.id;
          return (
            <li
              key={todo.id}
              className={cn(
                "group flex items-center gap-2 rounded-xl px-1.5 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05]",
                variant === "default" ? "py-1.5" : "py-1",
              )}
            >
              {/* Tombol centang berdiri sendiri, BUKAN pembungkus baris. Dulu
                  tombol toggle membungkus judul sekaligus editor inline;
                  selain HTML-nya tidak valid, setiap klik ke field edit
                  menggelembung ke tombol dan mencentang tugasnya. */}
              <button
                type="button"
                onClick={() => onToggle(todo)}
                aria-pressed={isDone}
                aria-label={isDone ? "Tandai belum selesai" : "Tandai selesai"}
                className={cn(
                  "flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors",
                  isDone
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                    : "border-neutral-400 text-transparent hover:bg-black/[0.06] dark:border-neutral-500 dark:hover:bg-white/[0.08]",
                )}
              >
                <CheckIcon className="size-3" />
              </button>

              {isEditing ? (
                // Editor inline memakai komponen yang sama dengan composer.
                // Dua implementasi berbeda akan membuat satu jalur bisa
                // menyimpan format token yang tidak dibaca jalur lain.
                // Editor adalah SAUDARA tombol centang, bukan isinya, jadi
                // mengetik di sini tidak menyentuh status selesai.
                <div className="min-w-0 flex-1">
                  <MentionComposerInput
                    value={editDraft}
                    onChange={setEditDraft}
                    mentions={mentionsByTodo[todo.id] ?? []}
                    onMentionsChange={() => {}}
                    onEnter={() => {
                      void onRename(todo, editDraft);
                      setEditing(null);
                    }}
                    onEscape={() => setEditing(null)}
                    className="h-7 min-h-7 py-0"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggle(todo)}
                  aria-label={isDone ? "Tandai belum selesai" : "Tandai selesai"}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                >
                  <AgendaTitle done={isDone}>
                    <NoteWithMentions
                      value={todo.title}
                      mentions={mentionsByTodo[todo.id] ?? []}
                    />
                  </AgendaTitle>

                  {variant === "default" && todo.dueAt ? (
                    <span className="ml-auto w-20 shrink-0 text-right font-mono text-[10px] text-muted-foreground/70 uppercase tracking-[0.2em]">
                      {dueLabel(todo.dueAt)}
                    </span>
                  ) : null}
                </button>
              )}

              {/* Satu-satunya affordance edit. Dulu ada tombol "Edit" di
                  toolbar plus pensil per baris; keduanya melakukan hal yang
                  sama dan toolbar-nya terasa seperti tombol yang salah. Selalu
                  terlihat (opacity-60) karena layar sentuh tidak punya hover. */}
              <button
                type="button"
                onClick={() => {
                  setEditDraft(todo.title);
                  setEditing(todo.id);
                }}
                aria-label="Ubah tugas"
                className="shrink-0 rounded-full p-1 text-muted-foreground opacity-60 transition-opacity hover:text-foreground hover:opacity-100 focus-visible:opacity-100"
              >
                <PencilIcon className="size-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onDelete(todo)}
                aria-label="Hapus tugas"
                className="shrink-0 rounded-full p-1 text-muted-foreground opacity-60 transition-opacity hover:text-destructive hover:opacity-100 focus-visible:opacity-100"
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 ? (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant={variant === "compact" ? "ghost" : "outline"}
                size="sm"
                className={cn(
                  "w-full",
                  variant === "compact"
                    ? "mt-0.5 h-6 justify-start px-1 text-[10px] text-muted-foreground"
                    : "mt-1.5",
                )}
              >
                Lihat semua ({ordered.length})
              </Button>
            }
          />
          <PopoverContent align="start" className="w-80">
            <ul className="flex max-h-80 flex-col divide-y divide-black/5 overflow-y-auto scrollbar-none dark:divide-white/10">
              {ordered.map((todo) => {
                const isDone = todo.doneAt !== null;
                return (
                  <li
                    key={todo.id}
                    className="group flex items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-foreground/[0.03]"
                  >
                    <button
                      type="button"
                      onClick={() => onToggle(todo)}
                      aria-label={isDone ? "Tandai belum selesai" : "Tandai selesai"}
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        isDone
                          ? "border-foreground/30 bg-foreground/10 text-foreground"
                          : "border-foreground/30 text-transparent hover:bg-foreground/[0.06]",
                      )}
                    >
                      <CheckIcon className="size-3" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm", isDone && "text-muted-foreground line-through")}>
                        {todo.title}
                      </p>
                      {todo.dueAt ? (
                        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          {dueLabel(todo.dueAt)}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
    </>
  );

  const addButtonClass = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
    variant === "bento"
      ? "bg-black/[0.045] text-neutral-700 hover:bg-black/[0.07] dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/15"
      : "bg-white/75 text-neutral-700 hover:bg-white dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/15",
    variant === "bento" && "max-sm:px-2 max-sm:text-[10px]",
    variant === "compact" && "px-2 py-0.5 text-[10px]",
  );

  // Hanya "Tambah" yang tinggal di toolbar. Tombol "Edit" dulu mengaktifkan
  // mode yang memunculkan pensil per baris - dua jalan untuk hal yang sama,
  // dan toolbar-nya jadi terasa seperti tombol yang tidak melakukan apa-apa.
  const toolbar = (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={() => setComposing((v) => !v)} className={addButtonClass}>
        <PlusIcon className="size-3.5" />
        {variant === "compact" ? "Tambah" : "Tambah tugas"}
      </button>
    </div>
  );

  if (variant === "bento") {
    return (
      <div className="flex h-full min-h-0 flex-col rounded-[22px] bg-white/70 p-4 max-sm:min-h-[15rem] dark:bg-white/[0.06] sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-medium tracking-tight">TodoList</h2>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">Tugas selesai</p>
          </div>
          <p className="font-heading shrink-0 text-4xl font-normal leading-none tracking-tight tabular-nums sm:text-5xl">
            {doneLabel}
          </p>
        </div>

        <div className="mt-3">{toolbar}</div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-black/5 pt-2 dark:border-white/10">
          {composer}
          {listBody}
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-medium tracking-tight">TodoList</h2>
          <p className="font-heading text-2xl font-normal leading-none tracking-tight tabular-nums">
            {doneLabel}
          </p>
        </div>
        <div className="mt-1.5">{toolbar}</div>
        {composer}
        {listBody}
      </div>
    );
  }

  return (
    <Card
      title="TodoList"
      trailing={
        <Button variant="ghost" size="sm" onClick={() => setComposing((v) => !v)}>
          <PlusIcon />
          Baru
        </Button>
      }
    >
      {composer}
      {listBody}
    </Card>
  );
}

/**
 * Judul tugas dengan garis coret yang menempel pada lebar teks.
 *
 * Diported dari komponen MinimalAgendaWidget. Bedanya dengan `line-through`
 * bawaan: garis itu elemen tersendiri yang lebarnya dianimasikan dari 0 ke
 * 100%, jadi menyapu mengikuti lebar teks dan bukan melintasi seluruh baris.
 * Warna teks juga ikut meredup saat selesai, seperti aslinya.
 *
 * Warna memakai `currentColor` dengan opasitas, bukan palet `neutral-*` yang
 * dipakai komponen asalnya - palet itu tidak ada di repo ini dan tidak akan
 * ikut pindah ke dark mode.
 */
function AgendaTitle({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <span className="relative inline-block min-w-0 max-w-full flex-1">
      <span
        className={cn(
          "block max-w-full truncate text-sm transition-colors duration-300 ease-out",
          done ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {children}
      </span>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-2 left-0 h-px bg-current opacity-40",
          "transition-[width] duration-500 ease-in-out",
          done ? "w-full" : "w-0",
        )}
      />
    </span>
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
