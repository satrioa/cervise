import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  getSubscriptionAccessState,
  type SubscriptionLifecycleStatus,
} from "@/lib/billing/renewal";
import { isMasterAdminRole, type TenantAccessErrorCode } from "@/lib/auth/authorization";
import { publicPhotoUrl } from "@/lib/photos";
import { canManageEmployees } from "@/lib/auth/account-input";
import { resolveTargetOrganization } from "@/lib/supabase/org-resolution";
import { isTenantOwner } from "@/lib/tenant-slug";
import { normalizeAppRole } from "@/lib/nav/manifest";
import {
  BRANCH_SCOPE_ALL,
  BRANCH_SCOPE_COOKIE,
  LEGACY_BRANCH_COOKIE,
  type BranchScope,
} from "@/lib/supabase/branch-scope";

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
   * Konteks cabang yang dipilih user (khusus MASTER_ADMIN), dibaca dari cookie
   * di server. Staf biasa selalu `{ mode: "branch" }` ke cabangnya sendiri.
   *
   * Opsional supaya actor palsu di test lama tetap valid; helper di
   * `branch-scope.ts` menurunkan scope dari `branchId` bila field ini kosong.
   */
  branchScope?: BranchScope | null;
  /** Cabang dalam organisasi yang boleh dibaca. Satu elemen untuk staf. */
  accessibleBranchIds?: string[];
  /**
   * Apakah user ini pemilik tenant yang tercatat di
   * organizations.owner_profile_id.
   *
   * BUKAN "apakah dia MASTER_ADMIN". Hak operasional dan kepemilikan
   * adalah dua hal terpisah: orang yang mengurus kerja harian sebuah toko
   * belum tentu yang membayar paketnya, dan sebaliknya.
   */
  isOwner: boolean;
  /**
   * Akun masih memakai password generated dan harus menggantinya sendiri.
   *
   * Opsional supaya actor palsu di test lama tetap valid; layout memperlakukan
   * nilai kosong sebagai `false`.
   */
  mustChangePassword?: boolean;
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

/**
 * Actor untuk request yang sedang berjalan.
 *
 * `cache()` membuat pemanggilan berulang dalam satu render/aksi memakai hasil
 * yang sama. Sebelumnya `layout.tsx` dan `page.tsx` sama-sama memanggilnya,
 * lalu setiap server action dashboard memanggilnya lagi - masing-masing
 * membaca auth, employees, profiles, organizations, branches, dan
 * subscriptions dari awal. Sekarang biaya itu dibayar sekali per request.
 *
 * Di-cache terpisah dari `getActiveTenantForBilling` karena keduanya punya
 * aturan langganan yang berbeda; menyatukannya akan membuka halaman biasa
 * untuk tenant yang sudah berakhir.
 */
export const getActiveTenant = cache(async (): Promise<Actor> => {
  return resolveTenant({ allowExpiredSubscription: false });
});

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
export const getActiveTenantForBilling = cache(async (): Promise<Actor> => {
  return resolveTenant({ allowExpiredSubscription: true });
});

/**
 * Role dari `employees.role`, dinormalkan ke bentuk manifest.
 *
 * Fallback TECHNICIAN dipertahankan karena itu role dengan akses paling sempit
 * — lebih baik kehilangan fitur daripada mendapat akses — tetapi tidak lagi
 * diam-diam: role kosong atau tak dikenal dicatat, supaya laporan "akun
 * frontliner tampil sebagai teknisi" bisa ditelusuri ke baris database yang
 * salah, bukan dituduhkan ke UI.
 */
function resolveActorRole(row: EmployeeRow): string {
  const normalized = normalizeAppRole(row.role);
  if (normalized) return normalized;
  console.warn(
    `employees.role tidak dikenali (employee ${row.id}): ${JSON.stringify(row.role)}. Memakai TECHNICIAN.`,
  );
  return "TECHNICIAN";
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

  const role = resolveActorRole(actorRow);
  const masterAdmin = isMasterAdminRole(role);

  // Profil, organisasi, validasi cabang, dan langganan tidak saling
  // bergantung, jadi dibaca bersamaan. Dulu berurutan: satu kunjungan Home
  // menunggu empat round-trip berturut-turut sebelum satu query pun jalan.
  //
  // Pemeriksaannya tetap berurutan di bawah supaya kode error yang dilaporkan
  // tidak berubah: profil dulu, lalu organisasi, cabang, terakhir langganan.
  const [profileResult, organizationResult, branchValidation, subscriptionResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("is_active, full_name, email, avatar_url, must_change_password")
        .eq("id", auth.user.id)
        .maybeSingle(),
      supabase
        .from("organizations")
        // owner_profile_id ikut diambil pada select yang sudah ada, bukan query
        // terpisah: baris ini sudah dibaca untuk cek status, menambah satu kolom
        // tidak menambah pekerjaan database.
        .select("status, owner_profile_id")
        .eq("id", targetOrgId)
        .maybeSingle(),
      actorRow.branch_id
        ? supabase
            .from("branches")
            .select("id")
            .eq("id", actorRow.branch_id)
            .eq("organization_id", targetOrgId)
            .eq("is_active", true)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("tenant_subscriptions")
        .select("status, current_period_end, trial_ends_at, grace_days")
        .eq("organization_id", targetOrgId)
        .maybeSingle(),
    ]);

  const profile = profileResult.data;
  if (profileResult.error) throw new TenantAccessError("lookup_failed", profileResult.error.message);
  if (!profile?.is_active) throw new TenantAccessError("profile_inactive", "Profil tidak aktif");

  const organization = organizationResult.data;
  if (organizationResult.error) {
    throw new TenantAccessError("lookup_failed", organizationResult.error.message);
  }
  // `organizations.status` TIDAK dikecualikan untuk jalur penagihan, walaupun
  // namanya juga "blocked". Status ini berarti tenant-nya dinonaktifkan
  // seluruhnya - bisa karena penyalahgunaan, bukan sekadar tagihan yang lewat
  // tempo. Membukanya di jalur penagihan akan memberi halaman paket pada akun
  // yang seharusnya tidak melihat apa pun; tagihannya diselesaikan platform
  // owner dari sisi `/owner`.
  if (!organization || ["blocked", "suspended", "cancelled"].includes(organization.status)) {
    throw new TenantAccessError("subscription_blocked", "Organisasi tenant tidak aktif");
  }

  // Validasi cabang kepegawaian tetap berlaku untuk semua role. MASTER_ADMIN
  // yang `employees.branch_id`-nya menunjuk cabang nonaktif tetap ditolak,
  // sama seperti staf - kalau tidak, assignment rusak berubah jadi akses
  // diam-diam ke cabang lain.
  if (actorRow.branch_id) {
    if (branchValidation.error) {
      throw new TenantAccessError("lookup_failed", "Gagal memverifikasi cabang");
    }
    if (!branchValidation.data) {
      throw new TenantAccessError("branch_invalid", "Cabang tidak valid untuk tenant ini");
    }
  }

  const requestedScopeRaw =
    cookieStore.get(BRANCH_SCOPE_COOKIE)?.value ??
    cookieStore.get(LEGACY_BRANCH_COOKIE)?.value ??
    null;

  let branchScope: BranchScope | null = null;
  let accessibleBranchIds: string[] = [];

  if (masterAdmin) {
    const { data: branchRows, error: branchRowsError } = await supabase
      .from("branches")
      .select("id")
      .eq("organization_id", targetOrgId)
      .eq("is_active", true)
      .order("name");
    if (branchRowsError) throw new TenantAccessError("lookup_failed", "Gagal memuat daftar cabang");
    accessibleBranchIds = ((branchRows ?? []) as { id: string }[]).map((row) => row.id);

    const requestedBranch =
      requestedScopeRaw && requestedScopeRaw !== BRANCH_SCOPE_ALL ? requestedScopeRaw : null;
    const selectedBranch =
      requestedBranch && accessibleBranchIds.includes(requestedBranch) ? requestedBranch : null;

    // `all` hanya bermakna saat ada lebih dari satu cabang; kalau hanya satu,
    // tetap pakai mode cabang supaya aksi tulis tidak ikut terkunci.
    if (requestedScopeRaw === BRANCH_SCOPE_ALL && accessibleBranchIds.length > 1) {
      branchScope = { mode: "all", organizationId: targetOrgId };
    } else {
      const fallbackBranch =
        (actorRow.branch_id && accessibleBranchIds.includes(actorRow.branch_id)
          ? actorRow.branch_id
          : null) ?? accessibleBranchIds[0] ?? null;
      const chosen = selectedBranch ?? fallbackBranch;
      branchScope = chosen
        ? { mode: "branch", organizationId: targetOrgId, branchId: chosen }
        : null;
    }
  } else {
    branchScope = actorRow.branch_id
      ? { mode: "branch", organizationId: targetOrgId, branchId: actorRow.branch_id }
      : null;
    accessibleBranchIds = actorRow.branch_id ? [actorRow.branch_id] : [];
  }

  const effectiveBranchId = branchScope?.mode === "branch" ? branchScope.branchId : null;

  if (subscriptionResult.error) {
    throw new TenantAccessError("lookup_failed", subscriptionResult.error.message);
  }
  const subscriptionRow = subscriptionResult.data;

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
    branchId: effectiveBranchId,
    branchScope,
    accessibleBranchIds,
    employeeId: actorRow.id as string,
    role,
    // Apakah user ini pemilik tenant yang tercatat, bukan sekadar admin
    // operasional. Sumbernya organizations.owner_profile_id, bukan
    // employees.role: MASTER_ADMIN berarti mengelola operasional, yang lain
    // berarti bertanggung jawab atas tagihan. Keduanya bisa ada pada satu
    // orang, tapi tidak boleh saling disamakan.
    isOwner: isTenantOwner(
      organization?.owner_profile_id as string | null,
      auth.user.id,
    ),
    // Dibaca dari select profil yang sudah ada, bukan query terpisah.
    mustChangePassword: Boolean(profile.must_change_password),
    fullName: (profile.full_name as string | null) ?? null,
    // Path dari database tidak pernah dipakai mentah: divalidasi bentuknya dulu
    // supaya nilai yang tersuntik tidak bisa mengubah host URL.
    avatarUrl: publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", profile.avatar_url as string | null),
    subscription,
  };
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
