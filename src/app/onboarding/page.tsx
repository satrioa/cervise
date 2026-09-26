import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolvePostLoginDestination } from "@/lib/auth/post-login";
import { redirect } from "next/navigation";
import { OnboardingStepper } from "@/components/onboarding/stepper";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/onboarding");

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
  if (platformAdminResult.error) throw platformAdminResult.error;
  if (employeesResult.error) throw employeesResult.error;

  const cookieStore = await cookies();
  const destination = resolvePostLoginDestination({
    isPlatformAdmin: Boolean(platformAdminResult.data),
    savedOrganizationId: cookieStore.get("cervise_org")?.value ?? null,
    memberships: (employeesResult.data ?? []).map((employee) => ({
      organizationId: employee.organization_id as string,
      role: employee.role as string,
    })),
  });
  if (destination !== "/onboarding") redirect(destination);

  return <OnboardingStepper />;
}
