-- Tutup fail-open pada empat RPC sparepart/status.
--
-- Keempatnya punya guard yang sama:
--
--   if not (public.is_platform_admin() or v_role in ('MASTER_ADMIN',...)) then
--
-- v_role := public.caller_branch_role(...) mengembalikan NULL ketika tidak ada
-- baris yang cocok. Tapi NULL in (...) adalah NULL, bukan false, jadi
-- not (false or NULL) = NULL, dan "IF NULL THEN" di PL/pgSQL dianggap false.
-- Guard-nya dilewati dan exception TIDAK pernah dibuang.
--
-- Artinya: begitu caller_branch_role mengembalikan NULL - profil nonaktif,
-- tenant diblokir, langganan habis, cabang nonaktif, atau pemanggil bukan
-- karyawan sama sekali - keempat RPC itu terbuka, bukan tertutup.
--
-- Memperbaiki keempat body berarti menulis ulang logika bisnisnya. Yang paling
-- murah dan menutup keempatnya di satu tempat: caller_branch_role tidak pernah
-- mengembalikan NULL. String kosong bukan salah satu role yang diizinkan, jadi
-- guard menghasilkan false dan exception-nya benar-benar dibuang.
--
-- Perbandingan lain terhadap v_role (mis. v_role = 'TECHNICIAN') tetap
-- berperilaku sama seperti sebelumnya untuk pemanggil yang sah.

create or replace function public.caller_branch_role(p_branch_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((
    select employee.role
    from public.employees employee
    join public.profiles profile on profile.id = employee.profile_id
    join public.branches branch on branch.id = employee.branch_id
    join public.organizations organization on organization.id = employee.organization_id
    join public.tenant_subscriptions subscription
      on subscription.organization_id = organization.id
    where employee.profile_id = auth.uid()
      and employee.branch_id = p_branch_id
      and employee.is_active = true
      and profile.is_active = true
      and branch.is_active = true
      and organization.status not in ('blocked', 'suspended', 'cancelled')
      and (
        (subscription.status = 'trial' and subscription.trial_ends_at > now())
        or (
          subscription.status in ('active', 'grace')
          and subscription.current_period_end + (subscription.grace_days * interval '1 day') > now()
        )
      )
    limit 1
  ), '');
$function$;