import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  getSubscriptionAccessState,
  type SubscriptionLifecycleStatus,
} from "@/lib/billing/renewal";
import type { TenantAccessErrorCode } from "@/lib/auth/authorization";
import { publicPhotoUrl } from "@/lib/photos";
import { canManageEmployees } from "@/lib/auth/account-input";
import { resolveTargetOrganization } from "@/lib/supabase/org-resolution";
import { isTenantOwner } from "@/lib/tenant-slug";

export class TenantAccessError extends Error {
  readonly code: TenantAccessErrorCode;

  constructor(code: TenantAccessErrorCode, message: string) {
    super(message);
    this.name = "TenantAccessError";
    this.code = code;
  }
}

type EmployeeRow = {
  id: string;
  organization_id: string;
  branch_id: string | null;
  role: string;
};

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  paket: string | null;
  trial_ends_at: string | null;
  status: string;
};

export type Actor = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  orgId: string;
  branchId: string | null;
  employeeId: string;
  role: string;
  /**
   * Apakah user ini pemilik tenant yang tercatat di
   * organizations.owner_profile_id.
   *
   * BUKAN "apakah dia MASTER_ADMIN". Hak operasional dan kepemilikan
   * adalah dua hal terpisah: orang yang mengurus kerja harian sebuah toko
   * belum tentu yang membayar paketnya, dan sebaliknya.
   */
  isOwner: boolean;
  /** Identitas akun, untuk sidebar dan header. Boleh null kalau belum diisi. */
  fullName: string | null;
  avatarUrl: string | null;
  subscription: {
    status: SubscriptionLifecycleStatus;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    graceDays: number;
  } | null;
};

export async function getActiveTenant(): Promise<Actor> {
  return resolveTenant({ allowExpiredSubscription: false });
}

/**
 * Actor untuk halaman penagihan saja.
 *
 * Bedanya satu: subscription yang sudah berakhir (trial habis, atau status
 * blocked/suspended/cancelled) TIDAK lagi melempar error. Semua pemeriksaan
 * lain tetap jalan - profil harus aktif, tenant harus ada, cabang harus
 * valid, dan kegagalan query tetap `lookup_failed`.
 *
 * Kenapa perlu: tanpa ini, tenant yang trial-nya habis terkunci total, dan
 * halaman yang harus dipakai untuk membayar - `/app/pengaturan/subscription` -
 * ikut terkunci. Itu jalan buntu: tidak ada halaman yang bisaderr reached,
 * sehingga satu-satunya jalan keluar adalah platform owner intervene manual.
 * Halaman penagihan justru harus tetap bisa dibaca dan acted-on supaya tenant
 * bisa memilih paket dan membuat invoice.
 *
 * PENTUM: `allowExpiredSubscription` hanya untuk penagihan. Jangan dipakai di
 * halaman lain - readonly data tenant (servis, penjualan, stok) tidak boleh
 * terbaca oleh tenant yang langganannya sudah berhenti.
 */
export async function getActiveTenantForBilling(): Promise<Actor> {
  return resolveTenant({ allowExpiredSubscription: true });
}

async function resolveTenant(options: { allowExpiredSubscription: boolean }): Promise<Actor> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new TenantAccessError("unauthenticated", "Unauthorized");

  const cookieStore = await cookies();
  const orgFromCookie = cookieStore.get("cervise_org")?.value ?? null;
  const orgFromHeader = null; // placeholder for x-tenant-id if needed via middleware

  // try active org from cookie/header, else first active employee org
  let targetOrgId: string | null = orgFromCookie ?? orgFromHeader;

  // fetch all active employees for user
  const { data: emps, error: empsErr } = await supabase
    .from("employees")
    .select("id, organization_id, branch_id, role")
    .eq("profile_id", auth.user.id)
    .eq("is_active", true);
  if (empsErr) throw new TenantAccessError("lookup_failed", empsErr.message);
  if (!emps || emps.length === 0) throw new TenantAccessError("tenant_not_found", "Tenant not found — buat tenant dulu di /owner");

  const hasOwnerMembership = emps.some(
    (employee) => String(employee.role).toUpperCase() === "MASTER_ADMIN",
  );
  const hasValidTargetOrg = Boolean(
    targetOrgId && emps.some((employee) => employee.organization_id === targetOrgId),
  );

  if (emps.length > 1 && !hasOwnerMembership) {
    throw new TenantAccessError("assignment_required", "Akun memiliki lebih dari satu assignment tenant");
  }
  if (emps.length > 1 && !hasValidTargetOrg) {
    throw new TenantAccessError("assignment_required", "Pilih tenant terlebih dahulu");
  }

  // Resolusi org dipusatkan di resolveTargetOrganization supaya aturannya bisa
  // diuji. Perbedaan penting dari versi lama: ketika cookie menunjuk tenant yang
  // tidak punya assignment untuk user ini, hasilnya ditandai usedFallback -
  // sebelumnya orgId diganti diam-diam sehingga switcher menampilkan satu
  // tenant sementara seluruh data berasal dari tenant lain.
  const resolution = resolveTargetOrganization(targetOrgId, emps);
  if (!resolution) throw new TenantAccessError("tenant_not_found", "Tenant not found — buat tenant dulu di /owner");
  targetOrgId = resolution.organizationId;
  if (resolution.usedFallback && resolution.requestedOrgId) {
    console.warn(
      `tenant tidak bisa diakses, memakai assignment pertama: ${resolution.requestedOrgId}`,
    );
  }

  const actorRow = emps.find((employee) => employee.organization_id === targetOrgId) as EmployeeRow;
  if (!actorRow) throw new TenantAccessError("tenant_not_found", "Tidak punya akses ke tenant ini");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active, full_name, email, avatar_url")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError) throw new TenantAccessError("lookup_failed", profileError.message);
  if (!profile?.is_active) throw new TenantAccessError("profile_inactive", "Profil tidak aktif");

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    // owner_profile_id ikut diambil pada select yang sudah ada, bukan query
    // terpisah: baris ini sudah dibaca untuk cek status, menambah satu kolom
    // tidak menambah pekerjaan database.
    .select("status, owner_profile_id")
    .eq("id", targetOrgId)
    .maybeSingle();
  if (organizationError) throw new TenantAccessError("lookup_failed", organizationError.message);
  // `organizations.status` TIDAK dikecualikan untuk jalur penagihan, walaupun
  // namanya juga "blocked". Status ini berarti tenant-nya dinonaktifkan
  // seluruhnya - bisa karena penyalahgunaan, bukan sekadar tagihan yang lewat
  // tempo. Membukanya di jalur penagihan akan memberi halaman paket pada akun
  // yang seharusnya tidak melihat apa pun; tagihannya diselesaikan platform
  // owner dari sisi `/owner`.
  if (!organization || ["blocked", "suspended", "cancelled"].includes(organization.status)) {
    throw new TenantAccessError("subscription_blocked", "Organisasi tenant tidak aktif");
  }

  if (actorRow.branch_id) {
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("id")
      .eq("id", actorRow.branch_id)
      .eq("organization_id", targetOrgId)
      .eq("is_active", true)
      .maybeSingle();
    if (branchError) throw new TenantAccessError("lookup_failed", "Gagal memverifikasi cabang");
    if (!branch) throw new TenantAccessError("branch_invalid", "Cabang tidak valid untuk tenant ini");
  }

  const { data: subscriptionRow, error: subscriptionError } = await supabase
    .from("tenant_subscriptions")
    .select("status, current_period_end, trial_ends_at, grace_days")
    .eq("organization_id", targetOrgId)
    .maybeSingle();
  if (subscriptionError) throw new TenantAccessError("lookup_failed", subscriptionError.message);

  let subscription: Actor["subscription"] = null;
  if (subscriptionRow) {
    let status = subscriptionRow.status as SubscriptionLifecycleStatus;
    const currentPeriodEnd = subscriptionRow.current_period_end as string | null;
    const trialEndsAt = subscriptionRow.trial_ends_at as string | null;
    const graceDays = (subscriptionRow.grace_days as number | null) ?? 3;

    // Status dihitung lebih dulu supaya `subscription` yang dikembalikan
    // selalu menunjukkan keadaan sebenarnya, termasuk di jalur penagihan.
    // Trial yang sudah lewat hanya melempar di jalur biasa; di jalur
    // penagihan nilainya dibiarkan apa adanya supaya halaman tagihan bisa
    // menampilkan "Trial berakhir" beserta tanggalnya.
    const trialExpired =
      status === "trial" && (!trialEndsAt || new Date(trialEndsAt) <= new Date());
    if (trialExpired && !options.allowExpiredSubscription) {
      throw new TenantAccessError("subscription_expired", "Masa trial tenant telah berakhir");
    }

    if (status === "active" || status === "grace") {
      if (!currentPeriodEnd) {
        if (!options.allowExpiredSubscription) {
          throw new TenantAccessError("subscription_blocked", "Periode subscription tidak valid");
        }
      } else {
        status = getSubscriptionAccessState({
          status,
          currentPeriodEnd: new Date(currentPeriodEnd),
          graceDays,
          now: new Date(),
        });
      }
    }

    if (!options.allowExpiredSubscription && (status === "blocked" || status === "suspended" || status === "cancelled")) {
      throw new TenantAccessError("subscription_blocked", "Akses tenant diblokir. Hubungi platform owner untuk pembayaran.");
    }

    subscription = { status, currentPeriodEnd, trialEndsAt, graceDays };
  } else if (!options.allowExpiredSubscription) {
    throw new TenantAccessError("subscription_blocked", "Subscription tenant tidak ditemukan");
  }

  return {
    supabase,
    userId: auth.user.id,
    orgId: actorRow.organization_id as string,
    branchId: (actorRow.branch_id as string | null) ?? null,
    employeeId: actorRow.id as string,
    role: (actorRow.role as string) ?? "TECHNICIAN",
    // Apakah user ini pemilik tenant yang tercatat, bukan sekadar admin
    // operasional. Sumbernya organizations.owner_profile_id, bukan
    // employees.role: MASTER_ADMIN berarti mengelola operasional, yang lain
    // berarti bertanggung jawab atas tagihan. Keduanya bisa ada pada satu
    // orang, tapi tidak boleh saling disamakan.
    isOwner: isTenantOwner(
      organization?.owner_profile_id as string | null,
      auth.user.id,
    ),
    fullName: (profile.full_name as string | null) ?? null,
    // Path dari database tidak pernah dipakai mentah: divalidasi bentuknya dulu
    // supaya nilai yang tersuntik tidak bisa mengubah host URL.
    avatarUrl: publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", profile.avatar_url as string | null),
    subscription,
  };
}

export async function getActiveTenantStrict(): Promise<Actor> {
  return getActiveTenant();
}

/**
 * Gate untuk aksi yang butuh role MASTER_ADMIN.
 *
 * Dulu role ADMIN ikut diterima. Itu tidak sesuai dengan database: policy
 * employees_insert / employees_update di
 * 20260925090000_cervise_owner_platform_additive.sql hanya mengizinkan
 * has_tenant_role(..., ['MASTER_ADMIN']). Akibatnya ADMIN lolos cek di sini,
 * lalu insert-nya ditolak RLS sehingga user melihat kegagalan tanpa penjelasan.
 * Gate di sini harus lebih ketat dari yang ditulis database, bukan lebih longgar.
 */
export async function requireMasterAdmin(): Promise<Actor> {
  const actor = await getActiveTenant();
  if (!canManageEmployees(actor.role)) throw new Error("Hanya Master Admin");
  return actor;
}

export async function getTenantBySlugForCurrentUser(slug: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new TenantAccessError("unauthenticated", "Unauthorized");
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();
  const { data: org, error: orgErr } = await supabase.from("organizations").select("id, name, slug, paket, trial_ends_at, status").eq("slug", slug).maybeSingle();
  if (orgErr) throw new TenantAccessError("lookup_failed", orgErr.message);
  if (!org) notFound();
  if (["blocked", "suspended", "cancelled"].includes(org.status)) {
    throw new TenantAccessError("subscription_blocked", "Organisasi tenant tidak aktif");
  }
  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("id, organization_id, branch_id, role")
    .eq("profile_id", auth.user.id)
    .eq("organization_id", (org as TenantRow).id)
    .eq("is_active", true)
    .maybeSingle();
  if (empErr) throw new TenantAccessError("lookup_failed", empErr.message);
  if (!emp) notFound();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError) throw new TenantAccessError("lookup_failed", profileError.message);
  if (!profile?.is_active) throw new TenantAccessError("profile_inactive", "Profil tidak aktif");

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id")
    .eq("id", emp.branch_id)
    .eq("organization_id", emp.organization_id)
    .eq("is_active", true)
    .maybeSingle();
  if (branchError) throw new TenantAccessError("lookup_failed", branchError.message);
  if (!branch) throw new TenantAccessError("branch_invalid", "Cabang tidak valid untuk tenant ini");

  const { data: subscription, error: subscriptionError } = await supabase
    .from("tenant_subscriptions")
    .select("status, current_period_end, trial_ends_at, grace_days")
    .eq("organization_id", emp.organization_id)
    .maybeSingle();
  if (subscriptionError) throw new TenantAccessError("lookup_failed", subscriptionError.message);
  if (!subscription) throw new TenantAccessError("subscription_blocked", "Subscription tenant tidak ditemukan");

  const subscriptionStatus = subscription.status as SubscriptionLifecycleStatus;
  const currentPeriodEnd = subscription.current_period_end as string | null;
  const trialEndsAt = subscription.trial_ends_at as string | null;
  const graceDays = (subscription.grace_days as number | null) ?? 3;
  if (subscriptionStatus === "trial" && (!trialEndsAt || new Date(trialEndsAt) <= new Date())) {
    throw new TenantAccessError("subscription_expired", "Masa trial tenant telah berakhir");
  }
  if (subscriptionStatus === "active" || subscriptionStatus === "grace") {
    if (!currentPeriodEnd) throw new TenantAccessError("subscription_blocked", "Periode subscription tidak valid");
    const accessStatus = getSubscriptionAccessState({
      status: subscriptionStatus,
      currentPeriodEnd: new Date(currentPeriodEnd),
      graceDays,
      now: new Date(),
    });
    if (accessStatus === "blocked" || accessStatus === "suspended" || accessStatus === "cancelled") {
      throw new TenantAccessError("subscription_blocked", "Akses tenant diblokir");
    }
  }
  if (["blocked", "suspended", "cancelled"].includes(subscriptionStatus)) {
    throw new TenantAccessError("subscription_blocked", "Akses tenant diblokir");
  }

  return { organization: org as TenantRow, employee: emp as EmployeeRow, supabase, userId: auth.user.id };
}
