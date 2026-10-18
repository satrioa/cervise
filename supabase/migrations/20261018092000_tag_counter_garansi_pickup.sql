-- Counter kerusakan atomic, garansi mulai saat diambil, dan pencarian tag yang aman.
--
-- 1. `bump_service_tag_usage` menggantikan baca-sulis `usage_count` di
--    TypeScript. Dua kasir yang membuat servis dengan kerusakan yang sama di
--    detik yang sama sebelumnya bisa saling menimpa: keduanya membaca angka yang
--    sama lalu menulis angka yang sama, jadi satu penambahan hilang. Di database
--    penambahannya jadi operasi tunggal yang tidak bisa saling menimpa.
--
-- 2. `set_service_status` sekarang mengisi `garansi_until` saat status jadi
--    'Sudah Diambil'. Sebelumnya garansi dihitung dari tanggal servis MASUK, jadi
--    perbaikan yang butuh seminggu memotong garansi pelanggan seminggu dan klaim yang
--    seharusnya sah ditolak. Nilai diambil dari `garansi_value`/`garansi_unit`
--    yang sudah ada di baris servis, bukan angka tetap 90 hari seperti trigger
--    lama di tabel `services`.
--
-- 3. `search_service_tags` mengganti `.ilike` yang menerima `%` dan `_` mentah
--    dari user. Wildcard itu berarti kasir mengetik `%` saja bisa menarik semua
--    tag di cabang; pola dicocokkan di database dengan `LIKE ... ESCAPE`.

-- ---------------------------------------------------------------------------
-- 1. Counter tag
-- ---------------------------------------------------------------------------
create or replace function public.bump_service_tag_usage(
  p_branch_id uuid,
  p_name text,
  p_delta integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_branch_id is null or p_name is null or trim(p_name) = '' then
    raise exception 'branch dan nama tag wajib diisi';
  end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 1000 then
    raise exception 'delta tidak valid';
  end if;
  -- `p_delta` dipanggil hanya dari RLS branch yang sudah memeriksa
  -- organization_id, tapi organization_id diambil ulang supaya fungsi ini tetap
  -- aman seandainya suatu saat dipanggil dari tempat lain.
  if not exists (
    select 1 from public.branches
    where id = p_branch_id
      and (
        public.is_platform_admin()
        or public.can_access_tenant_branch(p_branch_id)
      )
  ) then
    raise exception 'branch tidak diizinkan';
  end if;

  insert into public.cervise_service_tags (branch_id, name, usage_count)
  values (p_branch_id, trim(p_name), greatest(p_delta, 0))
  on conflict (branch_id, lower(name)) do update
    set usage_count = greatest(public.cervise_service_tags.usage_count + p_delta, 0)
  returning usage_count into v_count;

  return v_count;
end;
$$;

revoke all on function public.bump_service_tag_usage(uuid, text, integer) from public, anon;
grant execute on function public.bump_service_tag_usage(uuid, text, integer) to authenticated;

-- `on conflict (branch_id, lower(name))` butuh index unik yang menyamakan
-- kapitalisasi. Tanpa itu, dua insert dengan nama berbeda huruf besar bisa
-- membuat dua tag untuk kerusakan yang sama.
create unique index if not exists cervise_service_tags_branch_name_lower_key
  on public.cervise_service_tags (branch_id, lower(name));

-- ---------------------------------------------------------------------------
-- 2. Garansi mulai saat diambil
-- ---------------------------------------------------------------------------
create or replace function public.set_service_status(
  p_servis_id uuid,
  p_status text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.cervise_services%rowtype;
  v_role text;
  v_allowed text[] := array['Masuk','Diagnosa','Menunggu Konfirmasi','Menunggu Sparepart','Dikerjakan','Selesai','Sudah Diambil','Batal'];
  v_parts integer;
begin
  if p_servis_id is null then
    raise exception 'servis wajib';
  end if;
  if p_status is null or not (p_status = any(v_allowed)) then
    raise exception 'status tidak dikenal';
  end if;

  select * into v_service
  from public.cervise_services
  where id = p_servis_id
  for update;

  if not found then
    raise exception 'servis tidak ditemukan';
  end if;

  v_role := public.caller_branch_role(v_service.branch_id);
  if not (public.is_platform_admin() or v_role in ('MASTER_ADMIN','ADMIN','FRONTLINER','TECHNICIAN')) then
    raise exception 'role tidak diizinkan mengubah status';
  end if;

  if v_service.status = p_status then
    return v_service.status;
  end if;

  if p_status = 'Batal' then
    select count(*) into v_parts
    from public.cervise_service_spareparts
    where servis_id = v_service.id and not is_returned;
    if v_parts > 0 then
      raise exception 'servis masih punya sparepart terpakai, putuskan dulu kembalikan ke stok atau tetap dipakai';
    end if;
  end if;

  update public.cervise_services
  set status = p_status,
      -- Garansi dihitung dari waktu pengambilan, bukan dari saat servis masuk.
      -- `make_interval` dipakai supaya perkalian integer tidak meluap.
      garansi_until = case
        when p_status <> 'Sudah Diambil' then v_service.garansi_until
        when v_service.garansi_value is null or v_service.garansi_value <= 0 then null
        else now() + case coalesce(v_service.garansi_unit, 'hari')
          when 'tahun' then make_interval(secs => v_service.garansi_value * 365 * 86400.0)
          when 'bulan' then make_interval(secs => v_service.garansi_value * 30 * 86400.0)
          else make_interval(secs => v_service.garansi_value * 86400.0)
        end
      end
  where id = v_service.id;

  insert into public.cervise_service_logs (branch_id, servis_id, actor_id, action, from_value, to_value, payload)
  values (v_service.branch_id, v_service.id, auth.uid(), 'status_change', v_service.status, p_status,
    case when p_note is null or trim(p_note) = '' then null else jsonb_build_object('note', trim(p_note)) end
  );

  return p_status;
end;
$$;

revoke all on function public.set_service_status(uuid, text, text) from public, anon;
grant execute on function public.set_service_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Pencarian tag tanpa wildcard dari user
-- ---------------------------------------------------------------------------
create or replace function public.search_service_tags(
  p_branch_id uuid,
  p_term text,
  p_limit integer default 10
)
returns table (name text, usage_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select t.name, t.usage_count
  from public.cervise_service_tags t
  where t.branch_id = p_branch_id
    and (
      public.is_platform_admin()
      or public.can_access_tenant_branch(t.branch_id)
    )
    and (
      p_term is null
      or trim(p_term) = ''
      -- `escape` membuat `%` dan `_` dari user jadi karakter biasa, bukan
      -- wildcard. Tanpa ini mengetik `%` menarik seluruh katalog tag.
      or t.name ilike '%' || replace(replace(replace(trim(p_term), '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
    )
  order by t.usage_count desc, t.name
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

revoke all on function public.search_service_tags(uuid, text, integer) from public, anon;
grant execute on function public.search_service_tags(uuid, text, integer) to authenticated;