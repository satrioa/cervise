import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const migration = read("supabase/migrations/20260925320000_add_todo_mentions.sql");
const action = read("src/app/app/actions/todo-mentions.ts");
const picker = read("src/components/dashboard/mention-picker.tsx");
// Logika mention pindah ke task-note-card.tsx waktu To-Do diekstrak jadi
// komponen shared antara dashboard teknisi dan frontliner. Guard ini ikut
// diarahkan ke sana, bukan ke file lama.
const dashboard = read("src/components/dashboard/task-note-card.tsx");

describe("cervise_todo_mentions", () => {
  it("satu catatan boleh punya banyak mention", () => {
    // Kalau jumlah mention dibatasi satu, tabel terpisah tidak perlu dan
    // dua kolom di tabel todo cukup.
    expect(migration).toMatch(/todo_id uuid not null references public\.cervise_staff_todos/);
  });

  it("minimal salah satu target harus terisi", () => {
    // Tanpa check ini baris kosong bisa masuk dan tidak punya tujuan yang
    // bisa dibuka dari catatan.
    expect(migration).toMatch(/check \(customer_id is not null or servis_id is not null\)/);
  });

  it("mention ikut terhapus bersama task", () => {
    expect(migration).toMatch(/todo_id uuid not null references public\.cervise_staff_todos\(id\) on delete cascade/);
  });

  it("kepemilikan mengikuti To-Do induk, bukan hanya akses ke tabel mentions", () => {
    // Policy select yang hanya memeriksa RLS tabel sendiri tidak mencegah
    // teknisi membuat mention untuk catatan rekan: dia butuh insert, dan
    // insert harus Cek todo induknya milik dia.
    expect(migration).toMatch(/exists \(\s*select 1 from public\.cervise_staff_todos/);
    expect(migration).toMatch(/t\.employee_id = auth\.uid\(\)/);
  });

  it("fungsi kepemilikan dikunci search_path dan tidak untuk public", () => {
    expect(migration).toMatch(/set search_path = public/);
    expect(migration).toMatch(/revoke all on function public\.owns_staff_todo\(uuid\) from public/);
  });

  it("RLS aktif dan anon tidak diberi akses", () => {
    expect(migration).toMatch(/alter table public\.cervise_todo_mentions enable row level security/);
    expect(migration).toMatch(/revoke all on public\.cervise_todo_mentions from anon/);
  });
});

describe("pencarian mention", () => {
  it("mencari nomor servis dan nama customer, tidak device", () => {
    // Device yang cocok terlalu banyak -- "Samsung" bisa ratusan baris, dan
    // teknisi yang sedang menulis catatan bukan sedang memilih di antara
    // ratusan device.
    expect(action).toMatch(/ilike\("service_number", pattern\)/);
    expect(action).toMatch(/from\("cervise_customers"\)[\s\S]*?ilike\("name", pattern\)/);
    expect(action).not.toMatch(/ilike\("device"/);
  });

  it("wildcard PostgREST, dan karakter wildcard dibuang dari kueri", () => {
    // Tanpa wildcard, "Budi" tidak akan cocok dengan "BUDI SANTOSO".
    // Tanpa pembuangan `%`, kueri bisa jadi pemindaian seluruh tabel.
    expect(action).toMatch(/likePattern/);
    expect(action).toMatch(/replace\(\/\[,%\(\)\*\\\\\]\/g, " "\)/);
  });
  it("tidak memfilter cabang manual karena RLS sudah membatasi", () => {
    // Menuliskannya lagi berarti dua sumber kebenaran untuk batas yang sama.
    expect(action).not.toMatch(/\.eq\("branch_id"/);
  });

  it("mention kembar diperlakukan sebagai berhasil, bukan kegagalan", () => {
    expect(action).toMatch(/error\.code === "23505"/);
  });
});

describe("Enter di kolom picker", () => {
  it("Enter memilih kandidat saat daftar terbuka", () => {
    expect(picker).toMatch(/if \(open && results\[active\]\)/);
  });

  it("preventDefault hanya di cabang memilih", () => {
    // Kalau preventDefault dipanggil saat daftar tertutup, Enter tidak akan
    // pernah sampai ke form.
    const handler = picker.slice(picker.indexOf("const onKeyDown"));
    const slice = handler.slice(0, handler.indexOf("return (\n"));
    const preventCount = (slice.match(/e\.preventDefault\(\)/g) ?? []).length;
    // 3 untuk Escape/ArrowDown/ArrowUp, 1 untuk memilih.
    expect(preventCount).toBe(4);
  });
});

describe("dashboard teknisi", () => {
  it("mention disimpan setelah task ada", () => {
    // todo_id harus sudah benar, jadi urutan ini tidak boleh dibalik.
    const createIdx = dashboard.indexOf("await createTodo(");
    const mentionIdx = dashboard.indexOf("await addTodoMentions(");
    expect(createIdx).toBeGreaterThan(-1);
    expect(mentionIdx).toBeGreaterThan(createIdx);
  });

  it("Enter di kolom teks tetap menyimpan walau ada mention dipilih", () => {
    // Kalau Enter di kolom teks bergantung pada daftar mention, teknisi
    // yang sudah memilih mention akan merasa Enter-nya mati.
    expect(dashboard).not.toMatch(/pendingMentions\.length === 0/);
  });

  it("mention dihapus dari state saat task dihapus", () => {
    // Cascade di database sudah membersihkannya; membiarkannya di state akan
    // menampilkan chip untuk catatan yang sudah tidak ada.
    expect(dashboard).toMatch(/delete next\[todo\.id\]/);
  });
});
