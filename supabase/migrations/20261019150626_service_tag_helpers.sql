-- Penghitung tag kerusakan yang tidak bisa saling menimpa, dan pencarian tag
-- yang membaca `%` sebagai karakter biasa.
--
-- Sebelumnya `usage_count` dibaca lalu ditulis dari TypeScript. Dua kasir yang
-- membuat servis dengan kerusakan sama di detik yang sama membaca angka yang
-- sama lalu menulis angka yang sama, jadi satu penambahan hilang. Di sini
-- penambahannya satu operasi database.
--
-- `on conflict (branch_id, lower(name))` butuh index unik yang menyamakan
-- kapitalisasi: constraint yang sudah ada case-sensitive, jadi "Battery" dan
-- "battery" bisa hidup berdampingan dan `on conflict` akan ditolak.
--
-- `search_service_tags` menggantikan `.ilike` yang menerima `%` dan `_` mentah
-- dari user: mengetik satu `%` menarik seluruh katalog tag cabang.

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
  -- Gerbang cabang diperiksa ulang di dalam fungsi, bukan hanya di RLS, supaya
  -- fungsi ini tetap aman seandainya suatu saat dipanggil dari tempat lain.
  if not exists (
    select 1 from public.branches
    where id = p_branch_id
      and (public.is_platform_admin() or public.can_access_tenant_branch(p_branch_id))
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

-- `if not exists` supaya migration ini tidak gagal kalau dijalankan ulang di
-- database yang sudah punya index-nya.
create unique index if not exists cervise_service_tags_branch_name_lower_key
  on public.cervise_service_tags (branch_id, lower(name));

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
    and (public.is_platform_admin() or public.can_access_tenant_branch(t.branch_id))
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
