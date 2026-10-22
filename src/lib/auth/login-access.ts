import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolvePostLoginDestination,
  type PostLoginDestination,
  type PostLoginMembership,
} from "./post-login";

/**
 * Status akses login, bukan isi tenant.
 *
 * `has_membership_record` sengaja terpisah dari `activeMemberships`: user yang
 * tenant-nya expired tetap punya catatan keanggotaan, tetapi tidak boleh
 * melihat data tenant itu. Tanpa flag ini, login akan salah menyimpulkan
 * "belum punya tenant" dan menampilkan onboarding.
 */
export type LoginAccess = {
  isPlatformAdmin: boolean;
  profileActive: boolean;
  activeMemberships: PostLoginMembership[];
  hasMembershipRecord: boolean;
  hasInactiveOwnership: boolean;
};

/** Kode yang dibaca halaman login dari `?error=`. */
export type LoginDenial =
  | "tenant-owner-inactive"
  | "tenant-inactive"
  | "account-inactive";

export type LoginAccessDecision =
  | { kind: "redirect"; destination: PostLoginDestination }
  | { kind: "denied"; reason: LoginDenial };

export function resolveLoginAccess(input: {
  access: LoginAccess;
  savedOrganizationId: string | null;
}): LoginAccessDecision {
  const { access } = input;

  // Platform admin tetap diprioritaskan seperti sebelumnya; halaman /owner
  // punya guard sendiri.
  if (access.isPlatformAdmin) {
    return { kind: "redirect", destination: "/owner" };
  }

  if (!access.profileActive) {
    return { kind: "denied", reason: "account-inactive" };
  }

  // Satu tenant aktif sudah cukup. Tenant expired lain tidak ikut terlihat
  // karena RLS tetap menolaknya.
  if (access.activeMemberships.length > 0) {
    return {
      kind: "redirect",
      destination: resolvePostLoginDestination({
        isPlatformAdmin: false,
        savedOrganizationId: input.savedOrganizationId,
        memberships: access.activeMemberships,
      }),
    };
  }

  // Pemilik mendapat kalimat yang berbeda: dia yang bertanggung jawab atas
  // tagihan, jadi tidak masuk akal menyuruhnya "hubungi admin".
  if (access.hasInactiveOwnership) {
    return { kind: "denied", reason: "tenant-owner-inactive" };
  }

  if (access.hasMembershipRecord) {
    return { kind: "denied", reason: "tenant-inactive" };
  }

  return { kind: "redirect", destination: "/onboarding" };
}

type RawLoginAccess = {
  is_platform_admin?: unknown;
  profile_active?: unknown;
  active_memberships?: unknown;
  has_membership_record?: unknown;
  has_inactive_ownership?: unknown;
};

function invalidResponse(): never {
  throw new Error("Respons status akses tidak valid");
}

export async function fetchLoginAccess(supabase: SupabaseClient): Promise<LoginAccess> {
  const { data, error } = await supabase.rpc("get_my_login_access");
  if (error) throw new Error("Gagal memeriksa status akses tenant");
  if (!data || typeof data !== "object") invalidResponse();

  const raw = data as RawLoginAccess;
  if (
    typeof raw.is_platform_admin !== "boolean" ||
    typeof raw.profile_active !== "boolean" ||
    typeof raw.has_membership_record !== "boolean" ||
    typeof raw.has_inactive_ownership !== "boolean" ||
    !Array.isArray(raw.active_memberships)
  ) {
    invalidResponse();
  }

  const activeMemberships = raw.active_memberships.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as { organization_id?: unknown }).organization_id !== "string" ||
      typeof (item as { role?: unknown }).role !== "string"
    ) {
      invalidResponse();
    }
    const membership = item as { organization_id: string; role: string };
    return { organizationId: membership.organization_id, role: membership.role };
  });

  return {
    isPlatformAdmin: raw.is_platform_admin,
    profileActive: raw.profile_active,
    activeMemberships,
    hasMembershipRecord: raw.has_membership_record,
    hasInactiveOwnership: raw.has_inactive_ownership,
  };
}
