import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src", "components", "dashboard", "task-note-card.tsx"),
  "utf8",
);

/**
 * Dua bug yang dilaporkan di kartu To-Do:
 *
 * 1. Mengklik field edit malah mencentang tugas. Penyebabnya editor inline
 *    berada DI DALAM `<button>` yang men-toggle selesai, jadi setiap klik
 *    menggelembung ke tombolnya.
 * 2. Tombol "Edit" di toolbar dan pensil per baris sama-sama membuka mode
 *    edit - dua affordance untuk satu aksi.
 */
describe("kartu To-Do: editor tidak men-toggle, satu tombol edit", () => {
  it("editor inline adalah saudara tombol centang, bukan isinya", () => {
    const rowStart = source.indexOf("{visible.map((todo) => {");
    const editorIndex = source.indexOf("<MentionComposerInput", rowStart);
    expect(rowStart).toBeGreaterThan(-1);
    expect(editorIndex).toBeGreaterThan(rowStart);

    // Semua <button> di antara awal baris dan editor harus sudah ditutup.
    // Kalau jumlah pembuka dan penutupnya beda, editor berada di dalam
    // tombol - dan klik ke field akan men-toggle tugas.
    const beforeEditor = source.slice(rowStart, editorIndex);
    const opened = (beforeEditor.match(/<button\b/g) ?? []).length;
    const closed = (beforeEditor.match(/<\/button>/g) ?? []).length;
    expect(opened).toBe(closed);
    // Tombol centang memang ada sebelum editor.
    expect(beforeEditor).toContain("<CheckIcon");
  });

  it("judul tugas hanya bisa men-toggle saat tidak sedang diedit", () => {
    const editorIndex = source.indexOf("{isEditing ?");
    const titleButtonIndex = source.indexOf("onClick={() => onToggle(todo)}", editorIndex);
    expect(editorIndex).toBeGreaterThan(-1);
    expect(titleButtonIndex).toBeGreaterThan(editorIndex);
  });

  it("hanya ada satu tombol edit, tanpa mode edit di toolbar", () => {
    expect(source.match(/aria-label="Ubah tugas"/g)?.length).toBe(1);
    expect(source).not.toContain("editingMode");
    expect(source).not.toContain("Edit tugas");
    // Pensil per baris selalu terlihat: layar sentuh tidak punya hover.
    // `hover:text-foreground` boleh berada di antara kelas opacity.
    expect(source).toMatch(/opacity-60[^"]*hover:opacity-100[^"]*focus-visible:opacity-100/);
  });

  it("memakai daftar dari server tanpa memuat ulang saat mount", () => {
    // Dashboard sudah mengirim To-Do dan mention sebagai prop, jadi kartu
    // tidak perlu satu round-trip lagi sebelum bisa dipakai.
    expect(source).toContain("initialTodos?: StaffTodo[]");
    expect(source).toContain("initialMentions?: TodoMention[]");
    expect(source).toMatch(/if \(initialTodos !== undefined\) return;/);
    expect(source).toContain("groupMentions(");
  });

  it("menyamakan daftar lokal dengan payload server yang baru", () => {
    // `router.refresh()` mengirim daftar baru tanpa me-mount ulang kartu.
    // Tanpa penyamaan ini, kartu tetap menampilkan baris yang SUDAH dihapus
    // di server, dan setiap aksi padanya berakhir "Tugas tidak ditemukan".
    expect(source).toContain("syncedFrom");
    expect(source).toMatch(/if \(initialTodos !== undefined && syncedFrom !== initialTodos\)/);
    expect(source).toMatch(/setTodos\(initialTodos\);/);
    expect(source).toMatch(/setMentionsByTodo\(groupMentions\(initialMentions \?\? \[\]\)\);/);
  });

  it("baris yang sudah dihapus di server dibuang, bukan dikembalikan", () => {
    // Aksi atas baris yang sudah tidak ada gagal dengan `not_found`.
    // Kalau baris itu dikembalikan ke daftar, baris yang sama akan gagal
    // terus-menerus dan tidak pernah bisa dihapus dari layar.
    expect(source).toContain('result.code === "not_found"');
    expect(source).toContain("onStaleTodo(");
    // `onStaleTodo` harus membuang baris dari daftar DAN mention-nya.
    expect(source).toMatch(/const onStaleTodo = \(id: string\) => \{[\s\S]*setTodos\(\(prev\) => prev\.filter\(\(t\) => t\.id !== id\)\);[\s\S]*delete next\[id\];/);
    // Daftar basi lain ikut hilang: daftar dimuat ulang dari server.
    expect(source).toMatch(/const onStaleTodo = \(id: string\) => \{[\s\S]*void syncFromServer\(\);/);
  });

  it("tidak mengembalikan baris yang gagal dihapus", () => {
    // Rollback `setTodos(previous)` mengembalikan baris yangserver sudah
    // hapus. Untuk `not_found` baris itu justru dibuang.
    const deleteHandler = source.slice(
      source.indexOf("const onDelete = async"),
      source.indexOf("const onRename = async"),
    );
    expect(deleteHandler).toContain('result.code === "not_found"');
    // Setelah `not_found` tidak boleh ada rollback.
    const notFoundBranch = deleteHandler.slice(deleteHandler.indexOf('result.code === "not_found"'));
    expect(notFoundBranch.slice(0, notFoundBranch.indexOf("}"))).not.toContain("setTodos(previous)");
  });
});
