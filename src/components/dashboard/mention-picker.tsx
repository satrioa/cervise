"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  searchMentionTargets,
  type MentionInput,
  type MentionTarget,
  type TodoMention,
} from "@/app/app/actions/todo-mentions";

/**
 * Chip mention pada satu catatan.
 *
 * Label diambil dari server (`TodoMention.label`), bukan disimpan di state
 * komponen. Kalau label disimpan lokal, rename customer tidak akan terlihat
 * sampai halaman dimuat ulang.
 */
export function MentionChips({
  mentions,
  onRemove,
  className,
}: {
  mentions: TodoMention[];
  onRemove?: (mention: TodoMention) => void;
  className?: string;
}) {
  if (mentions.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {mentions.map((m) => (
        <span
          key={m.mentionId}
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px]",
            m.kind === "customer"
              ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
              : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
          )}
        >
          <span className="truncate">{m.label}</span>
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(m)}
              aria-label={`Hapus mention ${m.label}`}
              className="shrink-0 opacity-50 transition-opacity hover:opacity-100"
            >
              <XIcon className="size-3" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

/**
 * Pemilih mention untuk catatan yang sedang disusun.
 *
 * Enter di kolom INI tidak pernah menyimpan. Kolom ini hanya memilih kandidat;
 * penyimpanan milik kolom teks di sebelahnya. Kalau Enter di sini ikut
 * menyimpan, memilih kandidat dan menyimpan jadi satu aksi yang tidak bisa
 * dipisahkan dari keyboard.
 *
 * `preventDefault` hanya dipanggil di cabang memilih, jadi saat daftar
 * tertutup Enter jatuh ke form tanpa ada yang tertahan.
 */
export function MentionPicker({
  mentions,
  onChange,
}: {
  mentions: MentionInput[];
  onChange: (next: MentionInput[]) => void;
}) {
  const [queryInput, setQuery] = useState("");
  const [results, setResults] = useState<MentionTarget[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const query = useMemo(() => queryInput.trim(), [queryInput]);
  // Query pendek berarti "belum cukup untuk mencari", jadi daftar harus
  // tertutup. Diderivasi dari query, bukan di-set di dalam effect: memanggil
  // setState sinkron di dalam effect memicu render berantai.
  const tooShort = query.length < 2;

  useEffect(() => {
    if (tooShort) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchMentionTargets(query)
        .then((r) => {
          if (cancelled) return;
          if (r.ok) {
            setResults(r.data);
            setActive(0);
            setOpen(true);
          } else {
            setResults([]);
            setOpen(false);
          }
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, tooShort]);

  // Klik di luar menutup daftar. Tanpa ini daftar tetap terbuka saat teknisi
  // menggeser fokus ke kolom lain, dan tetap menutupi isi di bawahnya.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (target: MentionTarget) => {
    const key = `${target.kind}:${target.id}`;
    if (!mentions.some((m) => `${m.kind}:${m.id}` === key)) {
      onChange([...mentions, { kind: target.kind, id: target.id }]);
    }
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Daftar terbuka: Enter memilih dan dihentikan. Tertutup: Enter
    // dibiarkan; kolom ini tidak pernah menyimpan.
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key !== "Enter") return;

    // Daftar terbuka: Enter memilih kandidat aktif.
    if (open && results[active]) {
      e.preventDefault();
      pick(results[active]);
    }
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="flex items-center gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Mention customer atau nomor servis"
          aria-label="Cari customer atau servis untuk disebut"
          className="h-8 min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2 text-sm outline-none focus:border-foreground/40"
        />
        {mentions.length > 0 ? (
          <span className="shrink-0 text-[11px] text-muted-foreground">{mentions.length} dipilih</span>
        ) : null}
      </div>

      {open && results.length > 0 ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border/60 bg-popover p-1 shadow-lg"
        >
          {results.map((r, i) => (
            <li key={`${r.kind}:${r.id}`}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(r)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  i === active ? "bg-foreground/[0.08]" : "",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 rounded px-1 py-0.5 text-[10px] uppercase",
                    r.kind === "customer"
                      ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                  )}
                >
                  {r.kind}
                </span>
                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                {r.sub ? (
                  <span className="shrink-0 truncate text-xs text-muted-foreground">{r.sub}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open && results.length === 0 ? (
        <div className="absolute left-0 right-0 z-40 mt-1 rounded-lg border border-border/60 bg-popover px-2 py-1.5 text-xs text-muted-foreground shadow-lg">
          Tidak ada yang cocok dengan &quot;{query}&quot;
        </div>
      ) : null}
    </div>
  );
}

/** Chip mention yang bisa diklik, untuk daftar tugas yang sudah tersimpan. */
export function LinkedMentionChips({ mentions }: { mentions: TodoMention[] }) {
  const router = useRouter();
  if (mentions.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {mentions.map((m) => (
        <button
          key={m.mentionId}
          type="button"
          onClick={() => router.push(m.kind === "servis" ? `/app/servis/${m.id}` : "/app/customer")}
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-colors",
            m.kind === "customer"
              ? "bg-cyan-500/15 text-cyan-700 hover:bg-cyan-500/25 dark:text-cyan-300"
              : "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300",
          )}
        >
          <span className="truncate">{m.label}</span>
        </button>
      ))}
    </div>
  );
}
