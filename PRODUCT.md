# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Frontliner** at the repair-shop counter: receives devices, opens service tickets, takes payments, runs the daily cash shift, and keeps customers informed. Works on a phone, often while standing at the counter.
- **Teknisi** at the bench: sees assigned jobs, records diagnosis and spare parts used, and moves tickets through the repair stages.
- **Admin / shop owner (master-admin)**: monitors revenue, per-branch performance, employees, inventory, and reports; can switch between branches.
- **Cervise operator team**: runs the SaaS side — tenants, packages, subscriptions, and account provisioning.
- **End customers of the repair shop**: never log in; they open the public tracking page with a service code.

All three shop roles (frontliner, technician, admin/owner) are equally daily users; no single role outranks the others in product decisions.

## Product Purpose

Cervise is a multibranch service-management app for gadget repair shops. It replaces paper notebooks and spreadsheets with one operational record: service tickets and their lifecycle, customers, spare parts, sales, daily cash, reports, and automatic WhatsApp status updates. Success means a counter worker can run the whole day — intake, repair status, payment, shift close — without leaving the app, and the owner can see every branch from one place.

## Positioning

Deep repair-shop operations, not generic retail POS: a seven-stage service lifecycle with warranty and pickup signature, per-branch cash and reporting, WhatsApp notifications driven by stage changes, and a public tracking page the customer can open without an account — all scoped per branch inside a multi-tenant SaaS. A neighboring POS or job-order tool could copy screens, but not the branch-scoped service workflow and the customer-facing tracking loop together.

## Operating Context

- Indonesian repair shops; UI copy, currency, and dates are Indonesian/Rupiah, with WIB as the operating timezone.
- Devices are taken in, diagnosed, quoted, repaired, and picked up — a ticket may wait days for customer confirmation or spare parts.
- Shops can have several branches; staff belong to one branch, while owners compare branches.
- Work happens on phones on the shop floor as much as on desktop; the app is an installable PWA.
- Customer communication runs through WhatsApp (Fonnte), not email.
- Subscription sales are handled manually: trial, then transfer confirmation over WhatsApp.

## Capabilities and Constraints

- **Service lifecycle**: Masuk → Diagnosa → Menunggu Konfirmasi → Sparepart → Dikerjakan → Selesai → Diambil, with 3-month warranty and a customer signature on pickup.
- **Roles**: master-admin, admin, frontliner, teknisi; one branch per user; strict per-branch data isolation enforced in the database (RLS), not only in the UI.
- **Modules**: dashboard/analytics, servis, customer, karyawan, cabang, inventori/sparepart and categories, penjualan (POS), keuangan (cash flow, transactions, shift close), laporan (service, sales, finance, shift, technician performance) with Excel/PDF export, garansi, audit log, settings (profile, roles, localization, appearance, subscription, usage).
- **Public tracking**: `/[slug]/lacak/[code]` lets a customer follow a ticket without logging in.
- **Tenancy**: signup/onboarding, tenant slugs, branch switcher, subscription trials and renewal cron, owner console for tenants/packages/billing.
- **Stack (existing, not a choice to revisit)**: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/Base UI, Supabase (Postgres + Auth + RLS), next-intl, deployed on Vercel. WhatsApp via Fonnte; cron routes protected by `CRON_SECRET`.
- **Current published plans**: Trial (14 days, 1 branch/3 users), Basic Rp 199rb/month (1 branch/3 users), Pro Rp 499rb/month (3 branches/15 users). Upgrade is pro-rata and payment confirmation is manual.
- **Undecided**: online payment gateway vs. manual transfer confirmation is not settled; the landing WhatsApp number is a placeholder. No committed accessibility standard; keep phone-first usability as the working bar.

## Brand Commitments

- Name: **Cervise** — “Manajemen Servis Gadget Multibranch”.
- Voice: plain, practical Indonesian for shop staff; short labels, no corporate jargon.
- Promise: light on the phone, built for frontliners and technicians.

## Evidence on Hand

- Working app and schema in this repo (`src/app`, `supabase/migrations`), 1452 tests across 128 files.
- Landing page with real feature copy and published plan prices (`src/app/page.tsx`, `src/components/pricing-three-tier.tsx`).
- Product/engineering notes: `docs/HANDOVER.md`, `docs/UNFINISHED.md`, `docs/printing.md`, `docs/sound-design.md`, design specs under `docs/superpowers/specs/`.
- Absent and must not be fabricated: customer testimonials, case studies, press, logos of real clients, real photos of shops or staff, audited performance/uptime claims.

## Product Principles

1. **The counter comes first.** Any flow a frontliner or technician touches must work one-handed on a phone, in a hurry, with a customer waiting.
2. **One branch, one truth.** Data, cash, and staff belong to a branch; owners may see across branches, staff may not.
3. **The ticket is the backbone.** Every module hangs off the service record and its stage; status changes are the event that drives notifications, warranty, and reporting.
4. **The customer sees progress without asking.** Tracking and WhatsApp updates reduce phone calls to the shop.
5. **Boring reliability over clever features.** Money, stock, and tickets must never silently disagree; correctness outranks novelty.
