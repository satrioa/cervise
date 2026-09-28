"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  newToken,
  parseMentionText,
  toMentionToken,
  VISIBLE_TITLE_MAX,
  visibleLength,
} from "@/lib/operational/mention-tokens";
import {
  searchMentionTargets,
  type MentionKind,
  type MentionTarget,
  type TodoMention,
} from "@/app/app/actions/todo-mentions";

/**
 * Editor catatan dengan chip mention sebaris.
 *
 * contenteditable, bukan `<input>`, karena chip harus jadi elemen di dalam alur
 * teks -- bukan teks yang dibaca drive-nya, dan bukan chip yang duduk di baris
 * sendiri. Keduanya yang/request-nya mustahil dilakukan tanpa DOM.
 *
 * Tiga hal di sini yang tidak terlihat dari kelihatannya, dan ketiganya
 * sumber bug kalau dilewatkan:
 *
 * 1. Editor ini TIDAK dikontrol parent. Kalau React menulis ulang isi DOM tiap
 *    ketikan, caret melompat ke awal. Isi DOM hanya ditulis ulang kalau nilai
 *    dari luar benar-benar berbeda dari hasil serialisasi terakhir.
 *
 * 2. Popup tidak boleh menyala saat komposisi IME berjalan. Mengetik `@` lalu
 *    huruf Indonesia memicu `input` di tengah komposisi; kalau popup ikut
 *    menyala, pilihan yang muncul berderet dan salah pilih.
 *
 * 3. Token dari paste harus dibuang. `{{m:k3f9a}}` yang ditempel bisa
 *    menghasilkan chip yang tidak punya baris di database -- catatan yang
 *    isinya hilang begitu disimpan.
 */

const CHIP_ATTR = "data-mention-token";

/**
 * Bentuk minimum yang dipakai editor untuk menggambar chip.
 *
 * Dipakai daripada `TodoMention` supaya editor tidak bergantung pada baris
 * database: mention yang baru dipilih belum punya `mentionId` maupun `todoId`
 * sampai server menyah Aging baliknya, tapi chipnya harus bisa langsung
 * tampil.
 */
export type ChipSource = {
  token: string;
  id: string;
  label: string;
  kind: MentionKind;
};

/** Peta token ke mention, untuk merender chip dari teks ber-token. */
export function mentionMap(mentions: readonly ChipSource[]): Map<string, ChipSource> {
  return new Map(mentions.map((m) => [m.token, m]));
}

function chipClass(kind: string) {
  return kind === "customer"
    ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
    : "bg-amber-500/15 text-amber-700 dark:text-amber-300";
}

/** Tulis isi editor dari string ber-token. */
function renderInto(el: HTMLElement, value: string, mentions: Map<string, ChipSource>) {
  el.replaceChildren();
  for (const segment of parseMentionText(value)) {
    if (segment.kind === "text") {
      if (segment.text) el.appendChild(document.createTextNode(segment.text));
      continue;
    }
    const mention = mentions.get(segment.token);
    // Token tanpa mention yang cocok: tampilkan apa adanya. Ini muncul saat
    // mention dihapus tapi catatan lama masih menyimpan tokennya. Melempar
    // error di sini akan membuat seluruh catatan gagal dirender.
    if (!mention) {
      el.appendChild(document.createTextNode(toMentionToken(segment.token)));
      continue;
    }
    el.appendChild(buildChip(mention.token, mention.label, mention.kind));
  }
  // Tanpa elemen anak sama sekali, browser tidak menampilkan placeholder.
  if (!el.firstChild) el.appendChild(document.createTextNode(""));
}

function buildChip(token: string, label: string, kind: string): HTMLElement {
  const chip = document.createElement("span");
  chip.setAttribute(CHIP_ATTR, token);
  chip.setAttribute("contenteditable", "false");
  chip.className = cn(
    "mx-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0 align-baseline text-[11px] font-medium",
    chipClass(kind),
  );
  chip.textContent = label;
  return chip;
}

/** Baca isi editor kembali menjadi string ber-token. */
function readFrom(el: HTMLElement): string {
  let out = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const token = node.getAttribute(CHIP_ATTR);
    if (token) {
      out += toMentionToken(token);
      return;
    }
    // Enter atau <br> di dalam field satu baris berarti pemisah kata, bukan
    // baris baru: field ini menyimpan satu kalimat, bukan paragraf.
    if (node.tagName === "BR") {
      out += " ";
      return;
    }
    for (const child of Array.from(node.childNodes)) walk(child);
  };
  for (const child of Array.from(el.childNodes)) walk(child);
  return out;
}

export type MentionComposerInputProps = {
  value: string;
  onChange: (next: string) => void;
  mentions: ChipSource[];
  onMentionsChange: (next: ChipSource[]) => void;
  placeholder?: string;
  className?: string;
  onEnter?: () => void;
  onEscape?: () => void;
  readOnly?: boolean;
};

export function MentionComposerInput({
  value,
  onChange,
  mentions,
  onMentionsChange,
  placeholder = "Tulis catatan, ketik @ untuk menyebut customer atau servis",
  className,
  onEnter,
  onEscape,
  readOnly = false,
}: MentionComposerInputProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Nilai terakhir yang DIHASILKAN editor ini sendiri. Nilai dari luar hanya
  // ditulis ke DOM kalau berbeda dari sini; kalau tidak, caret melompat.
  const lastEmitted = useRef(value);
  const composing = useRef(false);
  const map = mentionMap(mentions);
  // Peta mention ditulis ke ref di dalam efek, bukan langsung di render.
  // Ditulis saat render, ref akan berisi nilai dari render yang sudah lewat
  // pada efek yang membacanya.
  const mapRef = useRef(map);

  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<MentionTarget[]>([]);
  const [active, setActive] = useState(0);
  // Tidak ada cache chip baru. `mentions` dari parent sudah menyimpan label
  // dan kind, jadi peta langsung lengkap begitu mention dipilih -- cache kedua
  // hanya akan jadi sumber kebenaran yang bisa tidak sinkron.

  useLayoutEffect(() => {
    // Peta disegarkan di sini, bukan lewat efek terpisah: `useEffect` berjalan
    // setelah `useLayoutEffect`, jadi efek terpisah akan menulis ref terlalu
    // lambat dan renderInto masih memakai peta dari render sebelumnya.
    mapRef.current = map;
    const el = ref.current;
    if (!el) return;
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    renderInto(el, value, map);
  }, [value, map]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = readFrom(el);
    lastEmitted.current = next;
    onChange(next);
  }, [onChange]);

  // Pencarian. Berulang 250ms. Kueri pendek TIDAK mengosongkan hasil lewat
  // efek: `setState` sinkron di dalam efek memicu render berantai, dan daftar
  // yang kosong sudah bisa disimpulkan dari `query` saja saat render.
  useEffect(() => {
    if (query === null) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchMentionTargets(trimmed)
        .then((r) => {
          if (cancelled) return;
          if (r.ok) {
            setResults(r.data);
            setActive(0);
          } else {
            setResults([]);
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
  }, [query]);

  // Klik di luar menutup daftar. Tanpa ini daftar tetap menutupi isi di
  // bawahnya setelah teknisi berganti kolom.
  useEffect(() => {
    if (query === null) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.parentElement?.contains(e.target as Node)) setQuery(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [query]);

  /** Segmen `@...` tepat sebelum caret, kalau ada. */
  const atSegment = (): { start: number; text: string } | null => {
    const el = ref.current;
    if (!el) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) return null;
    // Ketik di dalam chip: bukan位置的 mention baru yang sedang disusun.
    const node = range.startContainer;
    if (node instanceof HTMLElement && node.hasAttribute(CHIP_ATTR)) return null;
    if (node.parentElement?.closest(`[${CHIP_ATTR}]`)) return null;

    const upToCaret = range.cloneRange();
    upToCaret.selectNodeContents(el);
    upToCaret.setEnd(range.startContainer, range.startOffset);
    const before = upToCaret.toString();
    const at = before.lastIndexOf("@");
    if (at === -1) return null;
    const segment = before.slice(at + 1);
    // Spasi atau baris baru berarti segment sudah selesai: itu teks biasa.
    if (/[\s\n]/.test(segment)) return null;
    if (segment.length > 60) return null;
    return { start: at, text: segment };
  };

  const onInput = () => {
    emit();
    if (composing.current) return;
    const seg = atSegment();
    setQuery(seg ? seg.text : null);
  };

  const pick = (target: MentionTarget) => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    const seg = atSegment();
    if (!seg) return;

    const already = mentions.some((m) => m.kind === target.kind && m.id === target.id);
    if (already) {
      // Sudah disebut. Buang saja teks `@...`-nya, jangan tambah chip kembar.
      removeAtSegment(seg.start);
      emit();
      setQuery(null);
      return;
    }

    // `used` harus berisi TOKEN, bukan id baris. Id itu uuid 36 karakter dan
    // tidak pernah dibandingkan dengan token yang baru dibuat, jadi mencampur
    // keduanya membuat tabrakan token lolos tanpa terdeteksi.
    const token = newToken(mentions.map((m) => m.token));
    const chip = buildChip(token, target.label, target.kind);

    const range = sel.getRangeAt(0);
    const upToCaret = range.cloneRange();
    upToCaret.selectNodeContents(el);
    upToCaret.setEnd(range.startContainer, range.startOffset);
    // `@` ada di offset `seg.start` pada teks gabungan; selection di dalam
    // satu text node, jadi harus dipetakan ke node itu.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let consumed = 0;
    let node: Text | null = null;
    let nodeStart = 0;
    while (walker.nextNode()) {
      const candidate = walker.currentNode as Text;
      const len = candidate.data.length;
      if (consumed + len >= seg.start) {
        node = candidate;
        nodeStart = consumed;
        break;
      }
      consumed += len;
    }
    if (!node) {
      setQuery(null);
      return;
    }

    const from = seg.start - nodeStart;
    const to = from + 1 + seg.text.length;
    range.setStart(node, from);
    range.setEnd(node, Math.min(to, node.data.length));
    range.deleteContents();
    node.splitText(range.startOffset);
    const after = node.nextSibling;
    if (after) after.parentNode?.insertBefore(chip, after);
    else el.appendChild(chip);

    onMentionsChange([...mentions, { token, id: target.id, label: target.label, kind: target.kind }]);

    // Caret setelah chip, bukan di dalam teks yang baru saja dipisah.
    const afterChip = document.createTextNode("");
    chip.parentNode?.insertBefore(afterChip, chip.nextSibling);
    const r = document.createRange();
    r.setStart(afterChip, 0);
    r.setEnd(afterChip, 0);
    sel.removeAllRanges();
    sel.addRange(r);

    emit();
    setQuery(null);
    setActive(0);
    el.focus();
  };

  const removeAtSegment = (start: number) => {
    const el = ref.current;
    if (!el) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let consumed = 0;
    let node: Text | null = null;
    let nodeStart = 0;
    while (walker.nextNode()) {
      const candidate = walker.currentNode as Text;
      const len = candidate.data.length;
      if (consumed + len >= start) {
        node = candidate;
        nodeStart = consumed;
        break;
      }
      consumed += len;
    }
    if (!node) return;
    const from = start - nodeStart;
    const r = document.createRange();
    r.setStart(node, from);
    r.setEnd(node, node.data.length);
    r.deleteContents();
  };

  const deleteChipBefore = () => {
    const host = ref.current;
    const sel = window.getSelection();
    if (!host || !sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;
    // Caret harus benar-benar di awal chip, tepat setelah teks kosong.
    if (range.startOffset !== 0) return false;

    // Cari node sibling tepat sebelum caret. Berjalan ke atas lewat
    // previousSibling: kalau menemukan elemen lain yang berisi teks, berhenti
    // -- artinya caret ada di dalam teks biasa, bukan tepat setelah chip.
    let found: HTMLElement | null = null;
    let node: Node | null = range.startContainer;
    while (node) {
      const sibling: Node | null = node.previousSibling;
      if (sibling) {
        if (sibling instanceof HTMLElement && sibling.hasAttribute(CHIP_ATTR)) {
          found = sibling;
          break;
        }
        if (sibling.textContent) break;
        node = sibling;
        continue;
      }
      if (node === host) break;
      node = node.parentNode;
    }
    if (!found) return false;

    const token = found.getAttribute(CHIP_ATTR) ?? "";
    found.remove();
    // Dicocokkan lewat token, bukan id: yang tersimpan di elemen chip adalah
    // token. Membandingkan dengan id akan membandingkan uuid dengan 6 karakter
    // dan tidak pernah cocok, jadi mention-nya menggantung di state.
    onMentionsChange(mentions.filter((m) => m.token !== token));
    emit();
    return true;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (composing.current) return;

    if (e.key === "Escape" && query !== null) {
      e.preventDefault();
      setQuery(null);
      return;
    }
    if (e.key === "Escape") {
      // Daftar sudah tertutup: Escape menutup composer, bukan hanya daftar.
      // Tanpa cabang kedua, Escape tidak pernah menutup apa pun setelah
      // daftar tertutup -- tombol-X jadi satu-satunya jalan keluar.
      e.preventDefault();
      emit();
      onEscape?.();
      return;
    }
    if (e.key === "ArrowDown" && query !== null) {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp" && query !== null) {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      if (query !== null && results[active]) {
        e.preventDefault();
        pick(results[active]);
        return;
      }
      e.preventDefault();
      emit();
      onEnter?.();
      return;
    }
    if (e.key === "Backspace" && !readOnly) {
      if (deleteChipBefore()) e.preventDefault();
    }
  };

  // Paste harus jadi teks polos. `preventDefault` mencegah token dari
  // clipboard menjadi chip yang tidak punya baris di database, dan
  // sekaligus membuang HTML yang bisa menyelundup lewat paste.
  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = (e.clipboardData.getData("text/plain") ?? "").replace(/[\r\n]+/g, " ");
    const clean = text.replace(/\{\{m:[0-9a-z]{6,10}\}\}/g, "");
    document.execCommand("insertText", false, clean);
  };

  const visible = visibleLength(value);
  const over = visible > VISIBLE_TITLE_MAX;

  return (
    <div className="relative w-full">
      <div
        ref={ref}
        role="textbox"
        aria-multiline={false}
        aria-label="Catatan tugas"
        contentEditable={!readOnly}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
          onInput();
        }}
        onBlur={emit}
        className={cn(
          "min-h-8 w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm outline-none",
          "focus:border-foreground/40 empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
          readOnly && "border-transparent bg-transparent px-0 py-0",
          over && "border-destructive/60",
          className,
        )}
      />

      {query !== null ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border/60 bg-popover p-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">
              {query.trim().length < 2 ? "Ketik minimal 2 karakter" : "Tidak ada yang cocok"}
            </li>
          ) : (
            results.map((r, i) => (
              <li key={`${r.kind}:${r.id}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(r)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                    i === active ? "bg-foreground/[0.08]" : "",
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 rounded px-1 py-0.5 text-[10px] uppercase",
                      chipClass(r.kind),
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
            ))
          )}
        </ul>
      ) : null}

      {over ? (
        <p className="mt-1 text-[11px] text-destructive">
          Catatan {(visible - VISIBLE_TITLE_MAX).toString()} karakter terlalu panjang.
        </p>
      ) : null}
    </div>
  );
}

/** Daftar catatan tersimpan: teks dengan chip sebaris, dibaca saja. */
export function NoteWithMentions({
  value,
  mentions,
  onOpen,
  className,
}: {
  value: string;
  mentions: TodoMention[];
  onOpen?: (mention: ChipSource) => void;
  className?: string;
}) {
  const router = useRouter();
  const map = mentionMap(mentions);
  return (
    <span className={cn("whitespace-pre-wrap break-words", className)}>
      {parseMentionText(value).map((segment, i) => {
        if (segment.kind === "text") return <span key={i}>{segment.text}</span>;
        const mention = map.get(segment.token);
        if (!mention) return <span key={i}>{toMentionToken(segment.token)}</span>;
        return (
          <span key={i}>
            <button
              type="button"
              onClick={() => {
                if (onOpen) {
                  onOpen(mention);
                  return;
                }
                router.push(mention.kind === "servis" ? `/app/servis/${mention.id}` : "/app/customer");
              }}
              className={cn(
                "mx-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0 align-baseline text-[11px] font-medium transition-colors",
                chipClass(mention.kind),
                "hover:brightness-95",
              )}
            >
              {mention.label}
            </button>
          </span>
        );
      })}
    </span>
  );
}
