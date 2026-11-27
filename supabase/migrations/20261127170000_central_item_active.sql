create or replace function public.set_central_item_active(
  p_central_item_id uuid, p_is_active boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare v_item public.cervise_central_items%rowtype;
begin
  select * into v_item from public.cervise_central_items where id = p_central_item_id for update;
  if not found then raise exception 'item pusat tidak ditemukan'; end if;
  if not (public.is_platform_admin() or public.has_tenant_role(v_item.organization_id, array['MASTER_ADMIN'::text])) then
    raise exception 'hanya master admin yang boleh mengubah status item';
  end if;
  update public.cervise_central_items set is_active = p_is_active, updated_at = now() where id = v_item.id;
end;
$$;
revoke all on function public.set_central_item_active(uuid, boolean) from public, anon;
grant execute on function public.set_central_item_active(uuid, boolean) to authenticated;
