-- Sesi kas milik CABANG, bukan karyawan.
--
-- Spec: docs/superpowers/specs/2026-09-28-frontliner-cash-and-shift-report-design.md
--
-- Satu laci = satu sesi terbuka. Kalau frontliner libur, ADMIN/MASTER_ADMIN
-- bisa membuka shift atas namanya sendiri; frontliner shift berikutnya bisa
-- melanjutkan atau menutup sesi yang sama.
--
-- `employee_id` tetap berarti "siapa yang membuka". Siapa yang menutup sudah
-- dicatat di `snapshot.closedByName`, jadi tidak perlu kolom baru.

-- ---------------------------------------------------------------------------
-- 1. Bersihkan sesi ganda sebelum index baru dibuat
-- ---------------------------------------------------------------------------
-- Index lama unik per karyawan, jadi satu cabang bisa punya beberapa sesi
-- terbuka (satu per frontliner). Sesi yang lebih lama ditutup otomatis dan
-- ditandai di snapshot supaya tidak hilang tanpa jejak.

update public.cervise_cash_sessions s
set
  closed_at = now(),
  closing_balance = s.opening_balance,
  expected_cash = s.opening_balance,
  variance = 0,
  snapshot = jsonb_build_object(
    'schemaVersion', 1,
    'branchName', coalesce(
      (select b.name from public.branches b where b.id = s.branch_id),
      '—'
    ),
    'employeeName', coalesce(
      (select p.full_name from public.profiles p where p.id = s.employee_id),
      '—'
    ),
    'date', to_char(s.open_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD'),
    'openAt', s.open_at,
    'closingAt', now(),
    'openingBalance', s.opening_balance,
    'closingBalance', s.opening_balance,
    'expectedCash', s.opening_balance,
    'variance', 0,
    'reason', 'Ditutup otomatis saat migrasi sesi kas per cabang (sesi ganda).',
    'services', '[]'::jsonb,
    'sales', '[]'::jsonb,
    'cashTx', '[]'::jsonb,
    'totals', jsonb_build_object(
      'services', 0,
      'sales', 0,
      'manualIn', 0,
      'manualOut', 0,
      'manualNet', 0,
      'expected', s.opening_balance
    )
  )
where s.id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by branch_id
        order by open_at desc, id desc
      ) as rn
    from public.cervise_cash_sessions
    where closed_at is null
  ) ranked
  where ranked.rn > 1
);

-- ---------------------------------------------------------------------------
-- 2. Satu sesi terbuka per cabang
-- ---------------------------------------------------------------------------

drop index if exists public.cervise_cash_sessions_open_unique;

create unique index if not exists cervise_cash_sessions_open_unique
  on public.cervise_cash_sessions(branch_id)
  where closed_at is null;

-- ---------------------------------------------------------------------------
-- 3. RLS: sesi dibaca/ditutup oleh semua role kas di cabang
-- ---------------------------------------------------------------------------
-- Insert tetap mengharuskan `employee_id = auth.uid()` — manager membuka atas
-- namanya sendiri, tidak mewakili frontliner yang absen.

drop policy if exists cervise_cash_sessions_select on public.cervise_cash_sessions;
create policy cervise_cash_sessions_select on public.cervise_cash_sessions
  for select to authenticated
  using (
    public.is_platform_admin()
    or public.can_access_tenant_branch(
      branch_id,
      array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER']::text[]
    )
  );

drop policy if exists cervise_cash_sessions_update on public.cervise_cash_sessions;
create policy cervise_cash_sessions_update on public.cervise_cash_sessions
  for update to authenticated
  using (
    public.is_platform_admin()
    or public.can_access_tenant_branch(
      branch_id,
      array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER']::text[]
    )
  )
  with check (
    public.is_platform_admin()
    or public.can_access_tenant_branch(
      branch_id,
      array['MASTER_ADMIN', 'ADMIN', 'FRONTLINER']::text[]
    )
  );
