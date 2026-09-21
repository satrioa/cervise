-- Cervise Supabase Schema - Multibranch RLS
-- Jalankan di Supabase SQL Editor atau via migration

-- branches
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id),
  name text not null,
  address text,
  paket text not null default 'trial' check (paket in ('trial','basic','pro')),
  trial_ends_at timestamptz default now() + interval '14 days',
  created_at timestamptz default now()
);

-- profiles extends auth.users
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null check (role in ('super_owner','master_admin','admin','frontliner','teknisi')),
  branch_id uuid references branches(id),
  created_at timestamptz default now()
);

-- customers per branch
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  name text not null,
  phone text not null,
  address text,
  created_at timestamptz default now()
);
create index idx_customers_branch on customers(branch_id);

-- spareparts stock only
create table if not exists spareparts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  name text not null,
  stock_qty int not null default 0,
  created_at timestamptz default now()
);

-- services workflow 7 statuses + garansi 3 bulan
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  customer_id uuid references customers(id),
  device text not null,
  complaint text,
  status text not null default 'Masuk' check (status in ('Masuk','Diagnosa','Menunggu Konfirmasi','Menunggu Sparepart','Dikerjakan','Selesai','Sudah Diambil')),
  teknisi_id uuid references profiles(id),
  sparepart_id uuid references spareparts(id),
  price int default 0,
  garansi_until timestamptz, -- set to Sudah Diambil + 90 days
  created_at timestamptz default now()
);
create index idx_services_branch on services(branch_id);
create index idx_services_status on services(status);

-- finance kas harian
create table if not exists finance_tx (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  type text not null check (type in ('pemasukan','pengeluaran')),
  amount int not null,
  description text,
  kas_date date not null default current_date,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index idx_finance_branch_date on finance_tx(branch_id, kas_date);

-- Enable RLS
alter table branches enable row level security;
alter table profiles enable row level security;
alter table customers enable row level security;
alter table spareparts enable row level security;
alter table services enable row level security;
alter table finance_tx enable row level security;

-- Policies: strict branch isolation (example - sesuaikan jwt claims)
-- Asumsi profiles.branch_id sudah di-set, dan app menyimpan branch_id di JWT via custom claims atau cek via profiles
-- Simpler: allow authenticated to read own branch via auth.uid() join

-- profiles: user can read own profile, master_admin/super_owner bisa lihat sesuai paket akan diatur di app layer + service_role untuk konsolidasi
create policy "profiles own" on profiles for select using (auth.uid() = id);
create policy "profiles insert own" on profiles for insert with check (auth.uid() = id);

-- customers: hanya branch sendiri
create policy "customers branch isolation" on customers for all using (
  branch_id = (select branch_id from profiles where id = auth.uid())
);
-- services, spareparts, finance_tx similar
create policy "services branch isolation" on services for all using (
  branch_id = (select branch_id from profiles where id = auth.uid())
);
create policy "spareparts branch isolation" on spareparts for all using (
  branch_id = (select branch_id from profiles where id = auth.uid())
);
create policy "finance branch isolation" on finance_tx for all using (
  branch_id = (select branch_id from profiles where id = auth.uid())
);
-- branches: user hanya lihat branch sendiri kecuali super_owner (service_role bypass)
create policy "branches own" on branches for select using (
  id = (select branch_id from profiles where id = auth.uid())
  or owner_id = auth.uid()
);

-- Garansi trigger: saat status = Sudah Diambil set garansi_until = now + 90 days
create or replace function set_garansi() returns trigger as $$
begin
  if new.status = 'Sudah Diambil' and old.status != 'Sudah Diambil' then
    new.garansi_until := now() + interval '90 days';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_garansi on services;
create trigger trg_garansi before update on services for each row execute function set_garansi();
