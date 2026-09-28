import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260925310000_service_notification_technician_assigned.sql",
  ),
  "utf8",
);

const flat = sql.replace(/\s+/g, " ").toLowerCase();

// Tubuh fungsi enqueue saja. Kalau tidak dipotong, assertion apa pun soal kunci
// dedupe bisa satisfied oleh kunci yang milik trigger lain di file yang sama --
// persis kegagalan diam yang paling mungkin terjadi di task ini.
const fnStart = flat.indexOf("create or replace function public.cervise_enqueue_service_technician_assigned");
const fnEnd = flat.indexOf("$$;", fnStart);
const fnBody = flat.slice(fnStart, fnEnd);

describe("trigger perpindahan teknisi", () => {
  it("menyalakan trigger pada perubahan teknisi_id, bukan pada status", () => {
    expect(flat).toContain("create trigger cervise_services_notify_assigned");
    expect(flat).toContain("after update of teknisi_id on public.cervise_services");
  });

  it("hanya menyala kalau teknisi benar-benar berubah dan bukan dilepas", () => {
    // Tanpa `is distinct from`, setiap penyimpanan ulang servis -- yang tidak
    // mengubah teknisi sama sekali -- akan mengirim ulang pesan.
    expect(flat).toContain("old.teknisi_id is distinct from new.teknisi_id");
    // Tanpa `is not null`, melepas teknisi (perpindahan ke NULL) mengirim
    // pesan ke tidak ada orang. Itu kondisi "dikembalikan ke antrean", bukan
    // penggantian orang.
    expect(flat).toContain("new.teknisi_id is not null");
  });

  it("memakai kunci dedupe BARU, bukan kunci yang sudah terpakai", () => {
    // Ini assertion yang paling menentukan di seluruh file. Kunci
    // `servis:<id>:created:technician` sudah dipakai trigger insert dengan
    // `on conflict (dedupe_key) do nothing`, jadi trigger baru yang memakainya
    // akan DILEWATI DIAM-DIAM: trigger terpasang, tes lewat, tidak ada baris
    // yang pernah masuk antrean. Kalau hanya trigger-nya yang ditambah tanpa
    // bentuk kunci baru, perbaikannya terlihat berhasil dan tidak mengubah
    // apa pun.
    expect(fnBody).toContain(":assigned:");
    // Kuncinya memakai variabel lokal, jadi yang harus dijamin adalah variabel
    // itu benar-benar berasal dari new.teknisi_id -- kalau tidak, dia bisa saja
    // di-hardcode dan assertion di bawah tetap hijau.
    expect(fnBody).toContain("v_technisi := new.teknisi_id");
    expect(fnBody).not.toContain(":created:technician:");
  });

  it("membedakan arah perpindahan lewat id teknisi di dalam kunci", () => {
    // Tanpa id teknisi di kunci, A -> B -> A menghasilkan kunci yang sama dan
    // perpindahan kembali ke A hilang. Kuncinya harus memuat siapa yang
    // ditugaskan, bukan hanya bahwa ada perubahan.
    expect(fnBody).toMatch(
      /'servis:' \|\| new\.id::text \|\| ':assigned:' \|\| v_technisi::text \|\| ':technician'/,
    );
  });

  it("membuat trigger idempoten lewat on conflict", () => {
    expect(fnBody).toContain("on conflict (dedupe_key) do nothing");
    expect(fnBody).toContain("insert into public.cervise_notification_outbox");
  });

  it("menjalankan trigger sebagai security definer", () => {
    // Aplikasi tidak punya hak apa pun pada outbox -- grant di-revoke dari anon
    // dan authenticated dan tidak ada policy RLS -- jadi security invoker akan
    // membuat insert gagal dengan error privilege. Dan kesalahannya senyap:
    // trigger tetap terpasang dan tes statis tetap hijau.
    expect(fnBody).toContain("security definer");
  });

  it("mematuhi saklar suppress_notifications", () => {
    // Seed script bergantung pada ini: tanpa pengecekan, baris notifikasi
    // demo tetap masuk antrean walau saklarnya menyala.
    expect(fnBody).toContain("current_setting('cervise.suppress_notifications', true)");
    expect(fnBody).toContain("= 'on'");
  });

  it("menolak hak eksekusi dari anon dan authenticated", () => {
    const privilegeLines = sql
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^(grant|revoke)\b/i.test(line));
    expect(privilegeLines.length).toBeGreaterThan(0);
    for (const line of privilegeLines) {
      expect(line).toContain("cervise_enqueue_service_technician_assigned");
    }
    expect(flat).toContain(
      "grant execute on function public.cervise_enqueue_service_technician_assigned() to service_role",
    );
  });
});
