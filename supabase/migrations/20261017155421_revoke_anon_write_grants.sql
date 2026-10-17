-- Cabut hak tulis peran anon.
--
-- Sebelas tabel ini masih memegang grant insert/update/delete untuk anon,
-- warisan grant-all di 20260925090000. Tidak satu pun punya policy untuk
-- anon, jadi RLS menutup semua baris dan grant-nya tidak pernah terpakai.
-- Modelskeamanan repo ini karena itu bergantung pada "tidak ada policy anon",
-- bukan pada pencabutan grant. Satu policy anon yang ceroboh sudah cukup untuk
-- menulis platform_admins untuk diri sendiri.
--
-- Jalur publik (halaman lacak, landing) memakai service role, bukan anon,
-- jadi pencabutan ini tidak menyentuh apa pun yang dipakai aplikasi.

revoke insert, update, delete on table
  public.branches,
  public.employees,
  public.invoices,
  public.lacak_testimonials,
  public.organizations,
  public.packages,
  public.platform_admins,
  public.platform_audit_logs,
  public.platform_settings,
  public.profiles,
  public.tenant_subscriptions
from anon;

revoke all on table
  public.branches,
  public.employees,
  public.invoices,
  public.lacak_testimonials,
  public.organizations,
  public.packages,
  public.platform_admins,
  public.platform_audit_logs,
  public.platform_settings,
  public.profiles,
  public.tenant_subscriptions
from public;