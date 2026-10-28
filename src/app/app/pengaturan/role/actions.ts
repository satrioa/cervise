"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant, type Actor } from "@/lib/supabase/actor";
import { canManageEmployees } from "@/lib/auth/account-input";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCanWrite, assertCanRead } from "@/lib/auth/require-menu";
import { sanitizePermissions, permissionsForSystemRole, CUSTOM_BASE_ROLES } from "@/lib/auth/permissions";
import type { CustomBaseRole } from "@/lib/auth/permissions";
import { type PermissionKey, PERMISSION_CATALOG, isPermissionKey, BASE_ROLE_LABEL } from "@/lib/auth/permissions";

type RoleRow = {
  key: string;
  name: string;
  baseRole: string;
  permissions: string[];
  isSystem: boolean;
};

function toRow(r: any): RoleRow {
  return {
    key: r.key,
    name: r.name,
    baseRole: r.base_role,
    permissions: r.permissions ?? [],
    isSystem: false,
  };
}

export async function getRoles(): Promise<RoleRow[]> {
  const actor = await getActiveTenant();
  assertCanRead(actor, "pengaturan_role");
  const { data, error } = await actor.supabase
    .from("cervise_roles")
    .select("key, name, base_role, permissions")
    .eq("organization_id", actor.orgId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map(toRow);
}

export type CreateRoleInput = {
  key: string;
  name: string;
  baseRole: CustomBaseRole;
  permissions: PermissionKey[];
};

export async function createRole(input: CreateRoleInput): Promise<{ ok: true }> {
  const actor = await getActiveTenant();
  assertCanWrite(actor, "pengaturan_role");
  // Hanya MASTER_ADMIN boleh membuat role (app-side gate).
  if (!canManageEmployees(actor.role)) throw new Error("Hanya Master Admin yang bisa membuat role.");
  const orgId = actor.orgId;

  const key = input.key.trim().toUpperCase();
  if (!key || !/^[A-Z][A-Z0-9_]{2,31}$/.test(key)) throw new Error("Kunci role tidak valid (3-32 huruf/angka/underscore, mulai huruf).");
  if (!input.name.trim()) throw new Error("Nama wajib");
  if (!CUSTOM_BASE_ROLES.includes(input.baseRole)) throw new Error("Dasar role tidak valid");
  const allowed = new Set(permissionsForSystemRole(input.baseRole));
  const picked = input.permissions.filter((p) => allowed.has(p));
  if (picked.length === 0) throw new Error("Minimal satu izin harus dipilih");

  const admin = createAdminClient();
  const { error } = await admin
    .from("cervise_roles")
    .insert({
      organization_id: orgId,
      key,
      name: input.name.trim(),
      base_role: input.baseRole,
      permissions: picked,
    });
  if (error) throw new Error(error.message);
  revalidatePath("/app/pengaturan/role");
  return { ok: true };
}

export type UpdateRoleInput = {
  key: string; // kunci lama, untuk where
  name: string;
  baseRole: CustomBaseRole;
  permissions: PermissionKey[];
};

export async function updateRole(input: UpdateRoleInput): Promise<{ ok: true }> {
  const actor = await getActiveTenant();
  assertCanWrite(actor, "pengaturan_role");
  if (!canManageEmployees(actor.role)) throw new Error("Hanya Master Admin yang bisa mengubah role.");
  const orgId = actor.orgId;

  if (!input.name.trim()) throw new Error("Nama wajib");
  if (!CUSTOM_BASE_ROLES.includes(input.baseRole)) throw new Error("Dasar role tidak valid");
  const allowed = new Set(permissionsForSystemRole(input.baseRole));
  const picked = input.permissions.filter((p) => allowed.has(p));
  if (picked.length === 0) throw new Error("Minimal satu izin harus dipilih");

  const admin = createAdminClient();
  const { error } = await admin
    .from("cervise_roles")
    .update({
      name: input.name.trim(),
      base_role: input.baseRole,
      permissions: picked,
    })
    .eq("organization_id", orgId)
    .eq("key", input.key);
  if (error) throw new Error(error.message);
  revalidatePath("/app/pengaturan/role");
  return { ok: true };
}

export async function deleteRole(key: string): Promise<{ ok: true }> {
  const actor = await getActiveTenant();
  assertCanWrite(actor, "pengaturan_role");
  if (!canManageEmployees(actor.role)) throw new Error("Hanya Master Admin yang bisa menghapus role.");
  const orgId = actor.orgId;

  const admin = createAdminClient();
  // Cek apakah masih dipakai karyawan.
  const { data: inUse, error: inUseError } = await admin
    .from("employees")
    .select("id")
    .eq("organization_id", orgId)
    .eq("role_key", key)
    .limit(1);
  if (inUseError) throw new Error(inUseError.message);
  if (inUse && inUse.length > 0) throw new Error("Role masih digunakan karyawan; ganti role mereka dulu.");

  const { error } = await admin
    .from("cervise_roles")
    .delete()
    .eq("organization_id", orgId)
    .eq("key", key);
  if (error) throw new Error(error.message);
  revalidatePath("/app/pengaturan/role");
  return { ok: true };
}

/** Daftar basis role + izin mereka (untuk UI). */
export function getBaseRoleCatalog() {
  return CUSTOM_BASE_ROLES.map((baseRole) => ({
    baseRole,
    label: BASE_ROLE_LABEL[baseRole],
    permissions: permissionsForSystemRole(baseRole),
  }));
}

/** Semua grup izin untuk UI checklist. */
export function getPermissionGroups() {
  return PERMISSION_CATALOG.map((group) => ({
    group: group.group,
    label: group.label,
    permissions: group.permissions.map((p) => ({
      key: p.key,
      label: p.label,
    })),
  }));
}