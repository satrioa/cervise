"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchLoginAccess, resolveLoginAccess } from "@/lib/auth/login-access";
import { slugify } from "@/lib/tenant-slug";
import { normalizePhone62 } from "@/lib/phone";
import { TENANT_NAME_MAX, TENANT_SLUG_MIN } from "@/lib/onboarding/validation";

export async function completeOnboarding(opts: {
  tenantName: string;
  branchName: string;
  alamat?: string;
  telepon?: string;
}) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Unauthorized");

  const access = await fetchLoginAccess(supabase);
  const decision = resolveLoginAccess({ access, savedOrganizationId: null });
  if (decision.kind === "denied") {
    throw new Error(
      decision.reason === "tenant-owner-inactive"
        ? "Langganan tenant Anda sudah berakhir. Hubungi platform owner untuk memperpanjang."
        : decision.reason === "account-inactive"
          ? "Akun Anda dinonaktifkan. Hubungi admin."
          : "Tenant Anda sedang tidak aktif. Hubungi pemilik toko atau admin.",
    );
  }
  if (decision.destination !== "/onboarding") redirect(decision.destination);

  const name = opts.tenantName.trim();
  if (!name || name.length > TENANT_NAME_MAX) throw new Error("Nama tenant tidak valid");

  const baseSlug = slugify(name);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(baseSlug) || baseSlug.length < TENANT_SLUG_MIN) {
    throw new Error("Slug tenant tidak valid");
  }

  const phone = normalizePhone62(opts.telepon) ?? "";
  const branchName = opts.branchName.trim() || "Cabang Pusat";
  const branchCity = opts.alamat?.trim() || null;
  let slug = baseSlug;
  let result: { organization_id: string; branch_id: string } | null = null;
  let lastError: { code?: string; message?: string } | null = null;

  for (let attempt = 0; attempt <= 10; attempt += 1) {
    const { data, error } = await supabase.rpc("complete_tenant_onboarding", {
      p_tenant_name: name,
      p_tenant_slug: slug,
      p_branch_name: branchName,
      p_branch_city: branchCity,
      p_branch_phone: phone || null,
    });

    if (!error) {
      const payload = (Array.isArray(data) ? data[0] : data) as {
        organization_id?: string;
        branch_id?: string;
      } | null;
      if (payload?.organization_id && payload.branch_id) {
        result = {
          organization_id: payload.organization_id,
          branch_id: payload.branch_id,
        };
        break;
      }
      throw new Error("Respons onboarding tidak valid");
    }

    lastError = error;
    if (error.code === "23505") {
      const suffix = `-${attempt + 2}`;
      slug = `${baseSlug.slice(0, 63 - suffix.length)}${suffix}`;
      continue;
    }

    if (error.code === "42501") {
      throw new Error(error.message || "Izin onboarding ditolak.");
    }

    throw new Error(error.message || "Gagal menyelesaikan onboarding");
  }

  if (!result) {
    throw new Error(lastError?.message || "Gagal membuat slug tenant unik");
  }

  const cookieStore = await cookies();
  cookieStore.set("cervise_org", result.organization_id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/app");
  revalidatePath("/app/pengaturan/subscription");
  return { organizationId: result.organization_id, branchId: result.branch_id };
}
