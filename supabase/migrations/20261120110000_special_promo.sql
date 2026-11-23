-- Special Promo: konten dan durasi bisa diatur Platform Owner dari /owner/settings.
alter table public.platform_settings
  add column if not exists promo_title text not null default 'Special Promo',
  add column if not exists promo_headline text not null default 'Bayar Sekali, Lisensi Selamanya',
  add column if not exists promo_subtext text not null default 'Tidak ada biaya lisensi berulang, tetapi biaya layanan tahunan tetap berlaku.',
  add column if not exists promo_price text not null default 'Rp 2.459 Jt/ Cabang',
  add column if not exists promo_included text[] not null default array[
    '1 permanent branch license',
    'Unlimited employee accounts',
    'All core features',
    'Repair management',
    'POS & Inventory',
    'Finance & Reports',
    'Role-based access control'
  ],
  add column if not exists promo_separate text[] not null default array[
    'WhatsApp API (optional)',
    'Additional storage (only if needed)',
    'Third-party premium integrations (optional)'
  ],
  add column if not exists promo_note text not null default 'Hosting and infrastructure are included in the license under a fair-use policy, subject to Cervise''s service terms.',
  add column if not exists promo_ends_at timestamptz not null default (now() + interval '7 days');

update public.platform_settings
set promo_ends_at = now() + interval '7 days'
where id = true and promo_ends_at is null;
