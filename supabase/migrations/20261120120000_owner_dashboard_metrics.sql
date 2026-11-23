-- Insiden platform dicatat manual oleh Platform Owner; dipakai UptimeCard.
create table if not exists public.platform_incidents (
  id uuid primary key default gen_random_uuid(),
  occurred_on date not null,
  service text not null check (service in ('API', 'WhatsApp', 'Database', 'Dashboard')),
  status text not null check (status in ('degraded', 'down')),
  minutes integer not null check (minutes between 1 and 1440),
  title text not null,
  updates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_incidents_occurred_on_idx
  on public.platform_incidents (occurred_on desc);

alter table public.platform_incidents enable row level security;

-- Metrik infrastruktur nyata: storage per bucket, ukuran database, jumlah user.
create or replace function public.owner_platform_metrics()
returns jsonb
language sql
security definer
set search_path = public, storage, auth
as $$
  select jsonb_build_object(
    'storage', coalesce((
      select jsonb_agg(jsonb_build_object(
        'bucket', bucket_id,
        'objects', objects,
        'bytes', bytes
      ))
      from (
        select bucket_id,
               count(*)::int as objects,
               coalesce(sum((metadata->>'size')::bigint), 0)::bigint as bytes
        from storage.objects
        group by bucket_id
      ) s
    ), '[]'::jsonb),
    'db_bytes', (select pg_database_size(current_database())::bigint),
    'users', (select count(*)::int from auth.users)
  );
$$;

revoke all on function public.owner_platform_metrics() from public;
grant execute on function public.owner_platform_metrics() to service_role;
