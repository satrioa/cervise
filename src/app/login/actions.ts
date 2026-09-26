"use server";

import { cookies } from "next/headers";
import { resolvePostLoginDestination } from "@/lib/auth/post-login";
import { createClient } from "@/lib/supabase/server";

export async function getPostLoginDestination(clientSavedOrganizationId: string | null = null) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sesi login tidak valid");

  const [platformAdminResult, employeesResult] = await Promise.all([
    supabase
      .from("platform_admins")
      .select("profile_id")
      .eq("profile_id", auth.user.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("employees")
      .select("organization_id, role")
      .eq("profile_id", auth.user.id)
      .eq("is_active", true),
  ]);

  if (platformAdminResult.error) throw new Error("Gagal memverifikasi platform admin");
  if (employeesResult.error) throw new Error("Gagal memverifikasi tenant akun");

  const cookieStore = await cookies();
  const savedOrganizationId = cookieStore.get("cervise_org")?.value ?? clientSavedOrganizationId;

  return resolvePostLoginDestination({
    isPlatformAdmin: Boolean(platformAdminResult.data),
    savedOrganizationId,
    memberships: (employeesResult.data ?? []).map((employee) => ({
      organizationId: employee.organization_id as string,
      role: employee.role as string,
    })),
  });
}
