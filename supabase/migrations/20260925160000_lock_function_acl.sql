-- Menutup warning advisor: helper RLS tidak perlu bisa dipanggil langsung dari klien.
-- Fungsi ini hanya dipakai di dalam ekspresi policy, jadi harus revoke untuk anon/authenticated.

revoke all on function public.cervise_sale_item_branch(uuid) from public;
revoke all on function public.cervise_sale_item_branch(uuid) from anon;
revoke all on function public.cervise_sale_item_branch(uuid) from authenticated;

-- Helper internal yang dipakai function lain; bukan API klien.
revoke all on function public.caller_branch_role(uuid) from authenticated;
