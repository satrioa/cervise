# Cervise Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the confirmed authentication, cross-tenant, service-role, and exposed-RPC vulnerabilities without guessing the unresolved operational schema.

**Architecture:** Keep middleware as an early redirect only, add an explicit server actor/role boundary shared by app actions, and use a migration to revoke unsafe RPC execution plus enforce profile/employee branch invariants in the database. Defer broad operational-table rewrites until the canonical `customers/services/spareparts/finance_tx` versus `cervise_*/repair_*/inventory_*` schema is selected.

**Tech Stack:** Next.js 16 App Router, Supabase SSR/Postgres RLS, PostgreSQL migrations, Vitest.

**Spec:** Security audit findings from the current session; canonical Supabase project `yvekuahqzeqxggdyjecc`.

## Global Constraints

- Work in the existing dirty checkout; do not discard or reset unrelated user changes.
- Do not apply a migration to production or create a remote branch; the user selected local-only validation because Supabase branches are paid.
- Keep service-role credentials server-only; never add them to client code or commit them.
- Do not change `billing_admin` semantics in this pass; preserve current full platform-admin behavior until product intent is confirmed.
- Do not invent `cervise_*`, `repair_*`, or `inventory_*` tables that do not exist in the canonical remote project.
- No comments in production code unless explicitly requested.

## Review Focus

- Unauthenticated `/app`, locale-prefixed `/en/app`, and middleware database-error requests must fail closed.
- A manager from organization A must not mutate a profile, Auth user, or branch belonging to organization B.
- `process_subscription_renewals()` must not be executable by `anon` or `authenticated`.
- A user must not be able to self-reassign `profiles.branch_id` to bypass branch isolation.
- A blocked tenant or user with an inactive profile/branch must not use tenant actions.

---

### Task 1: Add testable authorization primitives

**Files:**
- Create: `src/lib/auth/authorization.ts`
- Test: `src/lib/auth/authorization.test.ts`

**Interfaces:**
- Produces `normalizeRole`, `isManagerRole`, `isSalesRole`, and `getProtectedPathKind(pathname)`.

- [ ] Write tests for uppercase role normalization, manager/sales membership, and `/en/app` path detection.
- [ ] Run the focused test and verify it fails because the module does not exist.
- [ ] Implement the pure helpers without importing server-only modules.
- [ ] Run the focused test and verify it passes.

### Task 2: Harden database privileges and lifecycle invariants

**Files:**
- Create: `supabase/migrations/20260925122000_harden_auth_rls.sql`

**Interfaces:**
- Uses existing public tables/functions only; no new application API.

- [ ] Add revokes for `process_subscription_renewals()` and other public `SECURITY DEFINER` functions, granting only intended roles.
- [ ] Add `SET search_path` to the legacy warranty trigger function.
- [ ] Add an employee branch/organization validation trigger.
- [ ] Update `complete_tenant_onboarding()` to reject users with any historical employee assignment or inactive profile.
- [ ] Add a local static migration check for required revoke/guard statements.
- [ ] Do not apply the migration remotely; validate it locally and report that remote privileges remain unchanged.

### Task 3: Fix service-role employee target binding

**Files:**
- Modify: `src/app/app/karyawan/actions.ts`
- Modify: `src/app/app/sparepart/actions.ts`
- Modify: `src/app/app/servis/sparepart-actions.ts`
- Test: `src/lib/auth/authorization.test.ts`

- [ ] Replace first-employee lookups with the shared active tenant actor.
- [ ] Derive `profileId` from the authorized employee row instead of accepting it as a service-role target.
- [ ] Verify branch belongs to the employee organization before update/delete.
- [ ] Stop swallowing service-role update/delete errors; use a single checked target.
- [ ] Add regression tests for cross-organization target rejection.
- [ ] Run focused tests and typecheck.

### Task 4: Make route and profile authorization fail closed

**Files:**
- Modify: `middleware.ts`
- Modify: `src/app/app/layout.tsx`
- Modify: `src/app/dashboard/tenant/[tenant]/page.tsx`
- Modify: `src/app/app/pengaturan/profil/actions.ts`
- Test: `src/lib/auth/authorization.test.ts`

- [ ] Normalize locale prefixes before `/app` and `/dashboard/tenant` checks.
- [ ] Redirect protected paths when auth lookup fails instead of returning the response.
- [ ] Make `/app` distinguish unauthenticated, no-tenant, and blocked-tenant destinations.
- [ ] Remove client-controlled `profiles.branch_id` updates from the profile action; validate any branch change through the actor organization.
- [ ] Run focused tests, typecheck, and targeted lint.

### Task 5: Verify and report deferred schema-dependent work

**Files:**
- No additional production files unless a test exposes a regression in Tasks 1-4.

- [ ] Run `npm run test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint` and distinguish pre-existing legacy errors from new errors.
- [ ] Run `npm run build`.
- [ ] Re-query Supabase advisors and remote function privileges without mutating the project.
- [ ] Review the diff for unrelated changes and report deferred operational RLS/client-write work.

## Self-review

- The plan does not apply a remote migration or assume the unresolved operational schema.
- Every production behavior change has a focused test or an explicit database verification step.
- Service-role calls are only retained behind server-side authorization and target binding.
- Deferred work is limited to schema reconciliation, broad operational-table RLS, direct client query migration, and sales/inventory atomicity.
