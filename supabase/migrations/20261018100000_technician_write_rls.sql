-- RLS harus mengizinkan TECHNICIAN menulis servis dan customer.
--
-- Temuan dari test end-to-end: dashboard teknisi punya tombol "Servis baru" dan
-- `manifest.ts` memberi akses `/app/servis` ke semua role termasuk TECHNICIAN,
-- tapi `cervise_services_insert` dan `cervise_customers_insert` hanya
-- menerima MASTER_ADMIN, ADMIN, FRONTLINER. Hasilnya teknisi melihat form
-- lengkap lalu gagal dengan:
--
--   new row violates row-level security policy for table "cervise_customers"
--
-- Bukti bahwa ini ketidaksesuaian, bukan keputusan sadar: RPC
-- `consume_service_spareparts` dan `set_service_status` (keduanya security
-- definer) sudah menerima TECHNICIAN, jadi backend menganggap teknisi memang
-- bekerja pada servis di cabangnya sendiri.
--
-- Scope yang ditambahkan HANYA TECHNICIAN, dan hanya untuk baris di cabang
-- tempat ia menjadi employee aktif - `can_access_tenant_branch` sudah
-- memeriksa itu. Technician tetap tidak bisa menghapus, dan tetap tidak bisa
-- menulis ke cabang lain.

drop policy if exists cervise_customers_insert on public.cervise_customers;
create policy cervise_customers_insert on public.cervise_customers
  for insert to authenticated
  with check (
    public.is_platform_admin()
    or public.can_access_tenant_branch(
      branch_id,
      array['MASTER_ADMIN'::text, 'ADMIN'::text, 'FRONTLINER'::text, 'TECHNICIAN'::text]
    )
  );

-- `createServis` memperbarui nama/alamat customer yang sudah ada di baris yang
-- sama, jadi technisi butuh UPDATE juga - bukan hanya INSERT. Tanpa ini, servis
-- berikutnya untuk customer yang sama akan gagal, padahal INSERT-nya lolos.
drop policy if exists cervise_customers_update on public.cervise_customers;
create policy cervise_customers_update on public.cervise_customers
  for update to authenticated
  using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id))
  with check (
    public.is_platform_admin()
    or public.can_access_tenant_branch(
      branch_id,
      array['MASTER_ADMIN'::text, 'ADMIN'::text, 'FRONTLINER'::text, 'TECHNICIAN'::text]
    )
  );

drop policy if exists cervise_services_insert on public.cervise_services;
create policy cervise_services_insert on public.cervise_services
  for insert to authenticated
  with check (
    public.is_platform_admin()
    or public.can_access_tenant_branch(
      branch_id,
      array['MASTER_ADMIN'::text, 'ADMIN'::text, 'FRONTLINER'::text, 'TECHNICIAN'::text]
    )
  );

-- `updateServis` menulis kolom biasa (kerusakan, garansi, teknisi) saat
-- teknisi memperbaiki datanya sendiri. `consume_service_spareparts` sudah
-- mengizinkan TECHNICIAN, jadi menolak di sini hanya membuat perilakunya
-- tidak konsisten. Delete TIDAK disentuh: hapus servis tetap admin.
drop policy if exists cervise_services_update on public.cervise_services;
create policy cervise_services_update on public.cervise_services
  for update to authenticated
  using (public.is_platform_admin() or public.can_access_tenant_branch(branch_id))
  with check (
    public.is_platform_admin()
    or public.can_access_tenant_branch(
      branch_id,
      array['MASTER_ADMIN'::text, 'ADMIN'::text, 'FRONTLINER'::text, 'TECHNICIAN'::text]
    )
  );

-- Teknisi tidak boleh membuat log palsu di cabang orang lain, tapi log yang
-- dia buat sendiri untuk servis cabangnya itu wajar (mis. saat menambah
-- sparepart lewat RPC).
drop policy if exists cervise_service_logs_insert on public.cervise_service_logs;
create policy cervise_service_logs_insert on public.cervise_service_logs
  for insert to authenticated
  with check (
    public.is_platform_admin()
    or public.can_access_tenant_branch(
      branch_id,
      array['MASTER_ADMIN'::text, 'ADMIN'::text, 'FRONTLINER'::text, 'TECHNICIAN'::text]
    )
  );

-- Tag kerusakan dipakai form create-servis. Tanpa INSERT, teknisi tidak bisa
-- membuat tag baru hanya dari servis pertama yang dilaporkan.
drop policy if exists cervise_service_tags_write on public.cervise_service_tags;
create policy cervise_service_tags_write on public.cervise_service_tags
  for all to authenticated
  using (
    public.is_platform_admin()
    or public.can_access_tenant_branch(
      branch_id,
      array['MASTER_ADMIN'::text, 'ADMIN'::text, 'FRONTLINER'::text, 'TECHNICIAN'::text]
    )
  )
  with check (
    public.is_platform_admin()
    or public.can_access_tenant_branch(
      branch_id,
      array['MASTER_ADMIN'::text, 'ADMIN'::text, 'FRONTLINER'::text, 'TECHNICIAN'::text]
    )
  );

-- Kelengkapan (charger, box, sim card) juga ditulis dari form create.
drop policy if exists cervise_kelengkapan_options_write on public.cervise_kelengkapan_options;
create policy cervise_kelengkapan_options_write on public.cervise_kelengkapan_options
  for all to authenticated
  using (
    public.is_platform_admin()
    or public.can_access_tenant_branch(
      branch_id,
      array['MASTER_ADMIN'::text, 'ADMIN'::text, 'FRONTLINER'::text, 'TECHNICIAN'::text]
    )
  )
  with check (
    public.is_platform_admin()
    or public.can_access_tenant_branch(
      branch_id,
      array['MASTER_ADMIN'::text, 'ADMIN'::text, 'FRONTLINER'::text, 'TECHNICIAN'::text]
    )
  );