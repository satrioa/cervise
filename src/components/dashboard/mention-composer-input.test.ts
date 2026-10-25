import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const migration = read("supabase/migrations/20260925330000_add_todo_mention_tokens.sql");
const composer = read("src/components/dashboard/mention-composer-input.tsx");
const card = read("src/components/dashboard/task-note-card.tsx");
const todos = read("src/app/app/actions/todos.ts");

describe("token di database", () => {
  it("token dibuat client, bukan diturunkan dari id baris", () => {
    // Id baris itu uuid 36 karakter. Kalau token diambil dari sana, satu
    // mention memakan 44 karakter dan enam mention sudah melewati jatah 200.
    expect(migration).toMatch(/add column if not exists token text/);
    expect(migration).toMatch(/check \(token ~ '\^\[0-9a-z\]\{6,10\}\$'\)/);
  });

  it("baris lama yang belum punya token TOKENNYA diisi", () => {
    // Kalau dibiarkan null, not null di bawah akan gagal dan seluruh
    // migration berhenti di tengah.
    expect(migration).toMatch(/update public\.cervise_todo_mentions\s+set token = substr/);
  });

  it("token unik per catatan, bukan unik global", () => {
    // Unik global akan menolak mention customer yang sama di dua catatan
    // berbeda -- itu hal yang normal dan harus dibolehkan.
    expect(migration).toMatch(/on public\.cervise_todo_mentions\(todo_id, token\)/);
  });

  it("batas judul di database dilonggarkan, bukan 200", () => {
    // Check lama menghitung string yang sudah berisi token, jadi catatan 180
    // karakter terlihat akan ditolak tanpa petunjuk.
    expect(migration).toMatch(/between 1 and 600/);
  });
});

describe("batas panjang judul", () => {
  it("todos.ts mengukur teks terlihat, bukan string mentah", () => {
    expect(todos).toMatch(/stripMentionTokens\(trimmed\)\.trim\(\)\.length > TITLE_VISIBLE_MAX/);
  });

  it("batas kasar tetap ada sebagai pengaman, lebih longgar", () => {
    // Tanpa batas kasar, string ber-token yang sangat panjang tetap bisa
    // masuk kalau pemeriksaan terlihat dilewati.
    expect(todos).toMatch(/const TITLE_MAX = 600/);
    expect(todos).toMatch(/const TITLE_VISIBLE_MAX = 200/);
  });
});

describe("editor chip", () => {
  it("tidak dikontrol parent, supaya caret tidak melompat", () => {
    // Kalau React menulis ulang isi DOM tiap ketikan, caret memantul ke awal
    // dan mengetik di tengah kalimat jadi tidak mungkin.
    expect(composer).toMatch(/lastEmitted/);
    expect(composer).toMatch(/if \(value === lastEmitted\.current\) return/);
  });

  it("popup ditahan saat komposisi IME berjalan", () => {
    // Mengetik `@` lalu huruf Indonesia memicu `input` di tengah komposisi.
    // Kalau popup ikut menyala, pilihannya berderet dan salah pilih.
    expect(composer).toMatch(/onCompositionStart/);
    expect(composer).toMatch(/onCompositionEnd/);
    expect(composer).toMatch(/if \(composing\.current\) return/);
  });

  it("token dari paste dibuang", () => {
    // `{{m:k3f9a1}}` yang ditempel menghasilkan chip yang tidak punya baris di
    // database; isinya hilang begitu catatan disimpan.
    expect(composer).toMatch(/onPaste/);
    // Dicocokkan sebagai teks biasa, bukan regex: pola yang diuji sudah
    // mengandung backslash dan kurung kurawal, jadi escaping dua lapis di
    // dalam regex mudah salah baca.
    expect(composer).toContain("/\\{\\{m:[0-9a-z]{6,10}\\}\\}/g");
  });

  it("token baru dibuat dari daftar token, bukan daftar id", () => {
    // Id itu uuid 36 karakter dan tidak pernah dibandingkan dengan token 6
    // karakter, jadi mencampur keduanya membuat tabrakan lolos tanpa terdeteksi.
    expect(composer).toMatch(/newToken\(mentions\.map\(\(m\) => m\.token\)\)/);
  });

  it("chip dihapus dicocokkan lewat token, bukan id", () => {
    // Yang tersimpan di elemen chip adalah token. Membandingkan dengan id
    // membandingkan uuid dengan 6 karakter dan tidak pernah cocok.
    expect(composer).toMatch(/filter\(\(m\) => m\.token !== token\)/);
  });

  it("mention yang sama tidak dibuat dua kali", () => {
    expect(composer).toMatch(/already/);
  });
});

describe("kartu catatan", () => {
  it("mention-picker lama sudah dihapus total", () => {
    // Dua implementasi parser akan menyimpang; dan MentionPicker memakai
    // kolom token yang sekarang tidak ada.
    expect(card).not.toMatch(/mention-picker/);
    expect(card).not.toMatch(/MentionPicker/);
    expect(card).not.toMatch(/LinkedMentionChips/);
  });

  it("composer dan edit inline pakai editor yang sama", () => {
    // Dua implementasi berbeda akan membuat satu jalur bisa menyimpan format
    // token yang tidak dibaca jalur lain.
    const count = (card.match(/<MentionComposerInput/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("label tidak dikirim ke server", () => {
    // Label dibaca ulang dari tabel tujuan. Menjalankannya berarti ada dua
    // sumber kebenaran untuk teks chip.
    expect(card).toMatch(/map\(\(m\) => \(\{ kind: m\.kind, id: m\.id, token: m\.token \}\)\)/);
  });

  it("judul disimpan lengkap dengan token sejak awal", () => {
    // Kalau judul tanpa token baru disimpan setelah mention, ada dua
    // pembaruan dan ada celah di mana catatan tersimpan tanpa chip-nya.
    expect(card).toMatch(/draftMentions\.map/);
  });
});

/**
 * Chip mention duduk DI DALAM tombol judul (tombol yang mencentang tugas).
 * Kalau chip itu `<button>`, HTML-nya jadi `<button>` di dalam `<button>` -
 * tidak valid. Browser menutup tombol luar lebih dulu, jadi DOM yang
 * dirender bukan yang ditulis server dan hydration React gagal.
 *
 * Peran button tetap dipakai supaya chip tetap bisa diklik dan dibaca
 * screen reader; hanya elemennya yang diganti dari `<button>` jadi `<span>`.
 */
describe("chip mention tidak jadi button di dalam button", () => {
  function noteWithMentionsBody() {
    const start = composer.indexOf("export function NoteWithMentions");
    expect(start, "NoteWithMentions harus ada").toBeGreaterThan(-1);
    // Ambil sampai akhir file: NoteWithMentions adalah komponen terakhir.
    return composer.slice(start);
  }

  it("chip dirender sebagai span ber-peran button, bukan button", () => {
    const body = noteWithMentionsBody();
    // Tidak boleh ada <button> di dalam NoteWithMentions.
    expect(body).not.toContain("<button");
    // Tapi perannya tetap button supaya bisa diklik dan dibaca a11y.
    expect(body).toContain('role="button"');
    expect(body).toContain("tabIndex={0}");
  });

  it("klik chip tidak ikut mencentang tugasnya", () => {
    // Chip ada di dalam tombol judul yang men-toggle. Kalau kliknya
    // merambat, satu klik jadi dua aksi: buka customer DAN centang tugas.
    const body = noteWithMentionsBody();
    expect(body).toContain("event.stopPropagation()");
  });

  it("tombol judul memuat chip, jadi nesting-nya yang caurok", () => {
    // Penjaga: kalau chip nanti dipindah keluar dari tombol judul, span
    // ber-peran button tetap valid dan test ini bisa dilonggarkan.
    expect(card).toMatch(/<NoteWithMentions[\s\S]{0,200}value=\{todo\.title\}/);
  });
});
