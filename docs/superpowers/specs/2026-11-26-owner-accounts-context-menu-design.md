# Owner accounts — context menu & hard delete

Date: 2026-11-26

## Goal
On `/owner/accounts`, let a platform admin open a right-click context menu on an
account row with three actions: **Lihat detail**, **Nonaktifkan**, **Hapus akun**.
Deleting is a hard delete from the database.

## Decisions (confirmed with user)
- **Lihat detail** opens a read-only dialog with all account fields. No dedicated
  account detail page exists, and navigating to tenant detail would not cover
  unassigned/platform accounts.
- The last table column's toggle is replaced by a `...` button. The same menu
  opens on right-click anywhere on the row or on `...` click.
- **Hapus akun** uses a plain confirmation dialog (Batal / red Hapus akun), not
  typed confirmation.
- **Nonaktifkan** works for every account kind (tenant staff, platform admin,
  unassigned). Its label toggles to **Aktifkan** for inactive accounts so the
  action is reversible.

## Server actions (`src/app/owner/actions.ts`)
- `setAccountActive({ userId, active })`: `requirePlatformAdmin()`; refuse to act
  on the caller's own account; update `is_active` via admin client on `employees`,
  `platform_admins`, and `profiles` rows for that user id; revalidate
  `/owner/accounts` and `/owner/tenants`.
- `deleteOwnerAccount({ userId })`: `requirePlatformAdmin()`; refuse to delete
  the caller's own account; `admin.auth.admin.deleteUser(userId)`. Schema cascades
  remove `profiles` (FK `auth.users ... on delete cascade`), `employees`,
  `platform_admins`, attendance, todos, etc. Revalidate the same paths. FK
  violations (e.g. technician still referenced by `cervise_services`) propagate
  and are shown as an error toast — never swallowed.
- `setEmployeeActive` and `EmployeeActiveToggle` stay: still used by
  `/owner/tenants/[id]`.

## UI (`src/components/owner/owner-accounts-table.tsx`)
- One controlled Base UI `Menu` with a virtual anchor computed from either the
  right-click coordinates or the `...` button rect.
- Menu items: Lihat detail, Nonaktifkan/Aktifkan, separator, Hapus akun
  (destructive).
- Detail dialog: name, email, phone, tenant, branch, role, package, status,
  created, last sign-in — all from the existing `OwnerAccountRow`.
- Delete dialog: states the account name/email and that the deletion is
  permanent; Batal + red Hapus akun.
- Client calls server actions, then `router.refresh()` + `toast.success/error`,
  matching the existing client mutation pattern.

## Tests
- Source-level Vitest assertions in the repo's existing style: delete action
  contains self-delete guard, `auth.admin.deleteUser`, and revalidation; table
  contains `onContextMenu`, the three menu labels, and both dialogs.
- Add `owner-accounts-table.tsx` to `MUTATING_COMPONENTS` in
  `owner-actions-refresh.test.ts`.

## Out of scope
- Last-platform-owner protection, typed confirmation, dedicated account detail
  page, mobile bottom sheet (the `...` button covers touch).
