-- is_platform_admin harus hanya bisa dijawab tentang pemanggilnya sendiri.
--
-- Parameternya berasal dari pemanggil dan default-nya auth.uid(), jadi setiap
-- pengguna yang login bisa menebak UUID mana yang platform admin lewat satu
-- panggilan REST. Semua fungsi sekelasnya (is_tenant_member, has_tenant_role,
-- can_access_tenant_branch) sudah dikunci ke auth.uid(); yang ini belum.
--
-- Argumennya sengaja TIDAK dihapus supaya semua call site yang menulis
-- is_platform_admin(auth.uid()) tetap jalan. Yang dihapus adalah maknanya:
-- hasilnya selalu tentang auth.uid(), apa pun yang dikirim pemanggil.

create or replace function public.is_platform_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.platform_admins
    where profile_id = auth.uid() and is_active = true
  );
$function$;