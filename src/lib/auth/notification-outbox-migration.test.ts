import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260925290000_service_notification_outbox.sql",
  ),
  "utf8",
);

const flat = sql.replace(/\s+/g, " ").toLowerCase();

describe("outbox notifikasi servis migration", () => {
  it("membuat tabel outbox dengan state yang terbatas", () => {
    expect(flat).toContain("create table if not exists public.cervise_notification_outbox");
    expect(flat).toContain("check (state in ('pending','sent','skipped','failed'))");
  });

  it("tidak memberi foreign key ke servis supaya riwayat tidak hilang", () => {
    expect(flat).toContain("servis_id uuid");
    // Regex, bukan string.servis_id uuid not null references cuma menangkap
    // versi NOT NULL; rewrites nullable seperti
    // "servis_id uuid references public.cervise_services(id) on delete cascade"
    // lolos dari bentuk itu dan diam-diam mengembalikan data loss yang tabel ini
    // ada untuk cegah: cervise_service_logs memakai on delete cascade, jadi
    // menghapus servis menghancurkan riwayatnya.
    expect(flat).not.toMatch(/servis_id[^,]*references/);
  });

  it("membuat index antrean pending", () => {
    expect(flat).toContain("cervise_notification_outbox_pending_idx");
    expect(flat).toContain("where state = 'pending'");
  });

  it("membatasi akses hanya ke service_role", () => {
    expect(flat).toContain("alter table public.cervise_notification_outbox enable row level security");
    expect(flat).toContain("revoke all on public.cervise_notification_outbox from anon");
    expect(flat).toContain("revoke all on public.cervise_notification_outbox from authenticated");
    // Literal utuh, bukan substring "service_role": grant fungsi sudah memuat
    // kata itu, jadi menghapus grant tabel seluruhnya akan tetap hijau di sini
    // sementara dispatcher, satu-satunya konsumen, kehilangan semua akses ke
    // antrean.
    expect(flat).toContain(
      "grant select, insert, update, delete on public.cervise_notification_outbox to service_role",
    );
    // Tidak boleh ada policy: tanpa policy, hanya service_role yang bisa.
    expect(flat).not.toContain("create policy");
  });

  it("memasang trigger untuk insert dan perubahan status", () => {
    expect(flat).toContain("cervise_services_notify_created");
    expect(flat).toContain("cervise_services_notify_status");
    expect(flat).toContain("after insert on public.cervise_services");
    expect(flat).toContain("after update of status on public.cervise_services");

    // Fungsi trigger WAJIB security definer: aplikasi terhubung dengan token
    // user yang tidak punya hak apa pun pada outbox. Kalau dibikin invoker,
    // trigger berhenti menaruh baris tanpa error kompilasi dan tes statis ini
    // tetap hijau, jadi penjaga ini yang menahan perubahan diam-diam itu.
    const start = flat.indexOf(
      "create or replace function public.cervise_enqueue_service_notification",
    );
    expect(start).toBeGreaterThanOrEqual(0);
    expect(flat.slice(start, flat.indexOf("$$;", start))).toContain("security definer");
  });

  it("hanya menunda status kunci dan deduplikasi", () => {
    expect(flat).toContain("'selesai', 'sudah diambil'");
    expect(flat).toContain("on conflict (dedupe_key) do nothing");
    expect(flat).toContain("new.status is distinct from old.status");
  });

  it("menghormati saklar penekanan untuk seed", () => {
    expect(flat).toContain("cervise.suppress_notifications");
    expect(flat).toContain("cervise_set_notification_suppression");
  });

  it("menyediakan klaim atomik untuk dispatcher", () => {
    expect(flat).toContain("create or replace function public.claim_service_notifications");
    expect(flat).toContain("for update skip locked");
    // Sewa, bukan penghitung: klaim menggeser next_attempt_at supaya baris yang
    // ditinggalkan (worker mati, kontainer dibunuh di 60s) tidak langsung
    // diambil lagi oleh tick cron berikutnya. attempts milik dispatcher, yang
    // dinaikkan hanya saat benar-benar mengirim; kalau klaim ikut menaikkan,
    // MAX_ATTEMPTS = 4 hanya jadi sekitar 2 kiriman nyata.
    expect(flat).toContain("set next_attempt_at = now() + interval '2 minutes'");
    expect(flat).not.toContain("set attempts = o.attempts + 1");
  });

  it("tidak menyentuh hak akses di luar baris grant/revoke", () => {
    // Setiap baris grant/revoke hanya boleh menyasar outbox atau salah satu
    // funksinya; kalau file ini diam-diam melonggarkan tabel lain, baris itu
    // tidak akan punya target yang diizinkan di sini.
    //
    // Cakupan assertion ini lebih sempit dari judul lamanya. Filter
    // /^(grant|revoke)\b/i hanya melihat baris yang diawali grant/revoke, jadi
    // perubahan privilege di dalam blok do $$, alter default privileges, atau
    // alter table ... owner to tidak akan tertangkap. Yang terbukti di sini
    // hanya tidak ada baris privilege yang menyasar objek di luar daftar ini.
    const targets = [
      "public.cervise_notification_outbox",
      "claim_service_notifications",
      "cervise_set_notification_suppression",
    ];
    const privilegeLines = sql
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^(grant|revoke)\b/i.test(line));
    expect(privilegeLines.length).toBeGreaterThan(0);
    for (const line of privilegeLines) {
      expect(
        targets.some((target) => line.toLowerCase().includes(target)),
        `baris hak akses tak dikenal: ${line}`,
      ).toBe(true);
    }
  });
});
