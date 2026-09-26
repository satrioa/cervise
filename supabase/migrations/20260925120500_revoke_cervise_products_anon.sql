revoke all on table public.cervise_products from anon;
revoke all on function public.is_tenant_branch_member(uuid, uuid) from anon;
revoke all on function public.has_tenant_branch_role(uuid, uuid, text[]) from anon;
