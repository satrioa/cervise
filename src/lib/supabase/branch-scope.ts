import { isMasterAdminRole } from "@/lib/auth/authorization";

/**
 * Konteks cabang untuk request server.
 *
 * `all` bukan cabang. Ia artinya "baca seluruh cabang dalam organisasi",
 * dan TIDAK boleh dipakai untuk menulis data. Menulis selalu butuh satu
 * cabang konkret supaya tidak ada lagi kejadian data masuk ke cabang lain
 * hanya karena label di UI berubah.
 */
export type BranchScope =
  | { mode: "all"; organizationId: string }
  | { mode: "branch"; organizationId: string; branchId: string };

export const BRANCH_SCOPE_COOKIE = "cervise_scope";
export const LEGACY_BRANCH_COOKIE = "cervise_branch";
export const BRANCH_SCOPE_ALL = "all";

/**
 * UUID yang tidak mungkin ada. Dipakai sebagai filter pengaman ketika scope
 * kosong: lebih baik query mengembalikan nol baris daripada diam-diam
 * mengembalikan seluruh tabel.
 */
export const NEVER_MATCH_BRANCH_ID = "00000000-0000-0000-0000-000000000000";

/** Bentuk minimal actor yang dibutuhkan helper scope. */
export type BranchScopeActor = {
  orgId?: string | null;
  branchId?: string | null;
  branchScope?: BranchScope | null;
  accessibleBranchIds?: string[] | null;
};

export class BranchRequiredError extends Error {
  readonly code = "BRANCH_REQUIRED";

  constructor(message = "Pilih cabang terlebih dahulu untuk transaksi ini") {
    super(message);
    this.name = "BranchRequiredError";
  }
}

/**
 * Ambil scope dari actor. Actor uji lama belum punya `branchScope`, jadi
 * nilainya diturunkan dari `branchId` supaya seluruh action tetap kompatibel
 * selama migrasi bertahap.
 */
export function actorBranchScope(actor: BranchScopeActor): BranchScope | null {
  if (actor.branchScope) return actor.branchScope;
  if (actor.branchId && actor.orgId) {
    return { mode: "branch", organizationId: actor.orgId, branchId: actor.branchId };
  }
  return null;
}

export function isAllBranchScope(actor: BranchScopeActor): boolean {
  return actorBranchScope(actor)?.mode === "all";
}

export function actorWriteBranchId(actor: BranchScopeActor): string | null {
  const scope = actorBranchScope(actor);
  return scope?.mode === "branch" ? scope.branchId : null;
}

/**
 * Cabang yang boleh dibaca. `null` berarti satu cabang (`branchId`),
 * array berarti mode `all`.
 */
export function resolveReadBranchFilter(actor: BranchScopeActor): {
  branchId: string | null;
  branchIds: string[] | null;
} {
  const scope = actorBranchScope(actor);
  if (scope?.mode === "all") {
    return { branchId: null, branchIds: actor.accessibleBranchIds ?? [] };
  }
  const branchId = scope?.mode === "branch" ? scope.branchId : actor.branchId ?? null;
  return { branchId, branchIds: null };
}

/**
 * Terapkan scope baca ke query Supabase. Di mode `all`, baris disaring ke
 * daftar cabang yang bisa diakses; kalau daftarnya kosong, query sengaja
 * dibuat tidak cocok apa pun.
 */
export function applyBranchScope<T>(query: T, actor: BranchScopeActor, column = "branch_id"): T {
  const { branchId, branchIds } = resolveReadBranchFilter(actor);
  const builder = query as unknown as {
    eq: (col: string, value: string) => unknown;
    in: (col: string, values: string[]) => unknown;
  };
  if (branchIds) {
    if (branchIds.length === 0) return builder.eq(column, NEVER_MATCH_BRANCH_ID) as T;
    return builder.in(column, branchIds) as T;
  }
  return builder.eq(column, branchId ?? NEVER_MATCH_BRANCH_ID) as T;
}

/**
 * Cabang tujuan untuk aksi tulis.
 *
 * - Mode `branch`: cabang terkunci, `requestedBranchId` (kalau ada) harus sama.
 * - Mode `all`: wajib menyebut cabang tujuan secara eksplisit.
 * - Tidak ada scope: tolak.
 */
export function requireWriteBranch(
  actor: BranchScopeActor,
  requestedBranchId?: string | null,
): string {
  const scope = actorBranchScope(actor);

  if (scope?.mode === "all") {
    const requested = requestedBranchId?.trim() || null;
    if (!requested) throw new BranchRequiredError();
    const accessible = actor.accessibleBranchIds ?? [];
    if (accessible.length > 0 && !accessible.includes(requested)) {
      throw new Error("Cabang tidak valid untuk tenant ini");
    }
    return requested;
  }

  const branchId = scope?.mode === "branch" ? scope.branchId : actor.branchId ?? null;
  if (!branchId) throw new BranchRequiredError();
  if (requestedBranchId && requestedBranchId !== branchId) {
    throw new Error("Cabang tidak sesuai konteks yang dipilih");
  }
  return branchId;
}

export function canSwitchBranchScope(role: string | null | undefined, branchCount: number): boolean {
  return isMasterAdminRole(role) && branchCount > 1;
}

export type BranchOption = {
  id: string;
  label: string;
  meta: string;
  phone?: string | null;
};
