-- Sesi kas harian untuk FRONTLINER, plus sumber untuk Laporan Shift.
--
-- Spec: docs/superpowers/specs/2026-09-28-frontliner-cash-and-shift-report-design.md
--
-- Tiga bagian:
--   1. public.cervise_cash_sessions  — opening/closing per shift
--   2. public.finance_tx.source      — membedakan kas manual dari transaksi
--   3. public.cervise_sales.servis_id — pengait supaya servis tidak terhitung
--      dua kali di Laporan Shift
--
-- Catatan soal (2). Kas manual TIDAK memakai tabel terpisah. Kalau ia
-- disimpan di tabel sendiri, Laporan Shift harus menggabungkan tiga sumber
-- dan angka kas bisa tidak cocok dengan /app/keuangan/arus-kas yang membaca
-- finance_tx. Dengan satu tabel, ketiga laporan membaca angka yang sama.
--
-- Catatan soal (3). `cervise_services` tidak punya kolom pembayaran sama
-- sekali, jadi tidak ada cara tahu apakah servis sudah dibayar. Yang
-- menentukan: PaymentDialog membuat baris cervise_sales yang menunjuk servis
-- itu; tanpa pengait, servis tersebut masuk rekap dua kali — sekali lewat
-- price servis, sekali lewat total penjualan.

-- ---------------------------------------------------------------------------
-- 1. cervise_cash_sessions
-- ---------------------------------------------------------------------------
-- amount dan finance_tx.amount keduanya integer, jadi saldo tidak pecahan
-- rupiah. expected_cash dan variance nullable karena hanya diisi saat ditutup.

create table if not exists public.cervise_cash_sessions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  employee_id uuid not null references public.profiles(id),
  open_at timestamptz not null default now(),
  opening_balance integer not null check (opening_balance >= 0),
  closed_at timestamptz,
  closing_balance integer check (closing_balance >= 0),
  expected_cash integer,
  variance integer,
  snapshot jsonb,
  created_at timestamptz not null default now()
);

-- Sesi yang sudah tutup tidak bisa kembali terbuka tanpa update eksplisit:
-- kolom penutup dan snapshot harus terisi bersamaan.
alter table public.cervise_cash_sessions
  drop constraint if exists cervise_cash_sessions_closed_check;
alter table public.cervise_cash_sessions
  add constraint cervise_cash_sessions_closed_check
  check (
    (closed_at is null and closing_balance is null and snapshot is null)
    or
    (closed_at is not null and closing_balance is not null and snapshot is not null)
  );

-- Satu sesi terbuka per karyawan. Ini yang membuat "wajib isi saldo awal"
-- bisa ditegakkan database, bukan hanya oleh tombol di UI.
create unique index if not exists cervise_cash_sessions_open_unique
  on public.cervise_cash_sessions(employee_id)
  where closed_at is null;

create index if not exists cervise_cash_sessions_branch_closed_idx
  on public.cervise_cash_sessions(branch_id, closed_at desc);

alter table public.cervise_cash_sessions enable row level security;

-- Staff hanya boleh melihat sesinya sendiri; manager boleh semua sesi di
-- cabangnya. Urutan OR penting: `is_platform_admin()` dulu karena
-- can_access_tenant_branch() adalah SECURITY DEFINER yang membaca
-- employees — yang tidak bisa dilakukan oleh role yang sedang di-check.
drop policy if exists cervise_cash_sessions_select on public.cervise_cash_sessions;
create policy cervise_cash_sessions_select on public.cervise_cash_sessions
  for select to authenticated
  using (
    public.is_platform_admin()
    or (
      public.can_access_tenant_branch(branch_id)
      and (
        employee_id = auth.uid()
        or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN', 'ADMIN']::text[])
      )
    )
  );

-- FRONTLINER boleh menutup sesinya sendiri. MASTER_ADMIN dan ADMIN boleh
-- menutup sesi siapa pun di cabang mereka, untuk shift yang ditinggalkan.
drop policy if exists cervise_cash_sessions_insert on public.cervise_cash_sessions;
create policy cervise_cash_sessions_insert on public.cervise_cash_sessions
  for insert to authenticated
  with check (
    public.is_platform_admin()
    or (
      employee_id = auth.uid()
      and public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER']::text[])
    )
  );

drop policy if exists cervise_cash_sessions_update on public.cervise_cash_sessions;
create policy cervise_cash_sessions_update on public.cervise_cash_sessions
  for update to authenticated
  using (
    public.is_platform_admin()
    or (
      employee_id = auth.uid()
      and public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER']::text[])
    )
    or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN', 'ADMIN']::text[])
  )
  with check (
    public.is_platform_admin()
    or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER']::text[])
  );

-- Sesi yang sudah tertutup tidak dihapus: Laporan Shift merujuknya.
drop policy if exists cervise_cash_sessions_delete on public.cervise_cash_sessions;
create policy cervise_cash_sessions_delete on public.cervise_cash_sessions
  for delete to authenticated
  using (
    public.is_platform_admin()
    or public.can_access_tenant_branch(branch_id, array['MASTER_ADMIN', 'ADMIN']::text[])
  );

grant select, insert, update, delete on public.cervise_cash_sessions to authenticated;
grant select, insert, update, delete on public.cervise_cash_sessions to service_role;
revoke all on public.cervise_cash_sessions from anon;

-- ---------------------------------------------------------------------------
-- 2. finance_tx.source
-- ---------------------------------------------------------------------------
-- 'transaksi'   — baris yang sudah ada sebelum migration ini
-- 'kas_manual'  — diinput frontliner di luar penjualan
-- 'penyesuaian' — koreksi admin setelah shift ditutup
--
-- finance_update dan finance_delete tetap MASTER_ADMIN/ADMIN saja
-- (20260925122000:270-276). Koreksi sebelum tutup toko dibuat sebagai baris
-- 'penyesuaian' baru, bukan mengubah baris lama.

alter table public.finance_tx
  add column if not exists source text not null default 'transaksi'
  check (source in ('transaksi', 'kas_manual', 'penyesuaian'));

-- Kolom baru harus ikut view supaya klien yang membaca view bisa membedakan
-- sumber. CREATE OR REPLACE VIEW mempertahankan grant yang melekat pada view.
create or replace view public.cervise_finance_tx
  with (security_invoker = true) as
select id, branch_id, servis_id, type, amount, kas_date, metode, keterangan,
       description, created_by, created_at, source
  from public.finance_tx;

-- ---------------------------------------------------------------------------
-- 3. cervise_sales.servis_id
-- ---------------------------------------------------------------------------
-- Nullable: penjualan barang tidak terkait servis, dan baris lama tidak
-- boleh ikut berubah. Tidak ada view kompatibilitas untuk cervise_sales —
-- tiga view yang ada hanya cervise_branches, cervise_finance_tx, dan
-- cervise_spareparts (20260925130000:244-248).

alter table public.cervise_sales
  add column if not exists servis_id uuid
    references public.cervise_services(id) on delete set null;

create index if not exists cervise_sales_servis_idx
  on public.cervise_sales(servis_id) where servis_id is not null;
