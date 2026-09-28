-- Kode tracking publik untuk halaman lacak servis / cek garansi.
--
-- 1. tracking_code: 10 hex (40 bit, ~1.1 triliun kombinasi) yang di-generate
--    database, jadi tidak bisa dipilih klien dan otomatis berlaku untuk semua
--    jalur insert. Dicetak di struk, lalu menjadi kredensial pelanggan untuk
--    melihat status + garansi tanpa login.
-- 2. public_rate_limits: abuse guard per-IP untuk halaman publik. Rate limit
--    ini BUKAN pengaman utama (kode 40 bit tidak bisa ditebak), hanya mencegah
--    request bertubi-tubi dari satu sumber.

alter table public.cervise_services add column if not exists tracking_code text;

-- Backfill baris lama (jalur ini tidak mungkin NULL setelah di-set not null).
do $$
declare
  v_row record;
begin
  for v_row in select id from public.cervise_services where tracking_code is null loop
    update public.cervise_services
    set tracking_code = upper(encode(gen_random_bytes(5), 'hex'))
    where id = v_row.id
      and tracking_code is null;
  end loop;
end;
$$;

alter table public.cervise_services
  alter column tracking_code set default upper(encode(gen_random_bytes(5), 'hex')),
  alter column tracking_code set not null;

create unique index if not exists cervise_services_tracking_code_idx
  on public.cervise_services (tracking_code);

-- Rate limit hanya untuk service_role; tidak ada policy RLS sehingga
-- anon dan authenticated tidak bisa menyentuh tabel ini sama sekali.
create table if not exists public.public_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);

alter table public.public_rate_limits enable row level security;

revoke all on public.public_rate_limits from anon;
revoke all on public.public_rate_limits from authenticated;
grant select, insert, update, delete on public.public_rate_limits to service_role;
