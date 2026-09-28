"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CircleIcon, PlusIcon, XIcon } from "lucide-react";
import { LinkedMentionChips, MentionPicker } from "./mention-picker";
import { addTodoMentions, getTodoMentions, type MentionInput, type TodoMention } from "@/app/app/actions/todo-mentions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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

// ---------------------------------------------------------------------------
// To-Do personal
// ---------------------------------------------------------------------------

export function TaskNoteCard() {
  // `todos` null berarti belum termuat. Dipisah dari `loading` supaya
  // penanganannya tetap bertipe `StaffTodo[]` dan tidak perlu narrowing
  // di setiap pembaruan optimistik.
  const [todos, setTodos] = useState<StaffTodo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [due, setDue] = useState("");
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  // Mention yang dipilih tapi belum disimpan. Dipisah dari `mentionsByTodo`
  // supaya membatalkan composer tidak mengubah catatan yang sudah tersimpan.
  const [pendingMentions, setPendingMentions] = useState<MentionInput[]>([]);
  const [mentionsByTodo, setMentionsByTodo] = useState<Record<string, TodoMention[]>>({});

  const loading = !loaded;

  useEffect(() => {
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
          const grouped: Record<string, TodoMention[]> = {};
          for (const mention of m.data) {
            (grouped[mention.todoId] ??= []).push(mention);
          }
          setMentionsByTodo(grouped);
        });
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
    setPendingMentions([]);
    setComposing(false);

    // Mention disimpan setelah task-nya ada, karena `todo_id`-nya harus
    // sudah benar. Kalau gagal, task tetap tampil -- catatan tanpa
    // reference lebih baik daripada task yang hilang.
    if (pendingMentions.length > 0) {
      const added = await addTodoMentions({ todoId: result.data.id, mentions: pendingMentions });
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
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter di kolom teks selalu menyimpan. Kolom pencarian
                // mention punya aturan sendiri: Enter memilih kandidat yang
                // terbuka, dan tidak pernah menyimpan. Kalau Enter di kolom
                // teks ikut bergantung pada daftar mention, teknisi yang
                // sudah memilih mention akan merasa Enter-nya mati.
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
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-8"
              onClick={() => {
                setComposing(false);
                setPendingMentions([]);
              }}
            >
              <XIcon />
            </Button>
          </div>
          <MentionPicker mentions={pendingMentions} onChange={setPendingMentions} />
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
                  {isDone ? <CheckIcon className="size-3" /> : <CircleIcon className="size-3" />}
                </button>

                {/* `min-w-0 flex-1` membungkus teks dan chip, jadi chip yang
                    panjang membuat teks membungkus, bukan membuat baris melebar
                    melewati container. */}                <div className="min-w-0 flex-1">
                  {editing === todo.id ? (
                    <Input
                      autoFocus
                      defaultValue={todo.title}
                      onBlur={(e) => onRename(todo, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditing(null);
                      }}
                      className="h-7 w-full text-sm"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditing(todo.id)}
                      className={cn(
                        "block w-full truncate text-left text-sm",
                        isDone && "text-muted-foreground line-through",
                      )}
                    >
                      {todo.title}
                    </button>
                  )}
                  <LinkedMentionChips mentions={mentionsByTodo[todo.id] ?? []} />
                </div>

                <span className="mt-1 w-20 shrink-0 text-right font-mono text-[10px] text-muted-foreground/70 uppercase tracking-[0.2em]">
                  {dueLabel(todo.dueAt)}
                </span>

                <button
                  type="button"
                  onClick={() => onDelete(todo)}
                  aria-label="Hapus tugas"
                  className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
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
  if (!dueAt) return "â€”";
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "â€”";
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const days = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86_400_000);
  if (days < 0) return "Lewat";
  if (days === 0) return "Hari ini";
  if (days === 1) return "Besok";
  return due.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

