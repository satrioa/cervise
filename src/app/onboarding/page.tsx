import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { fetchLoginAccess, resolveLoginAccess } from "@/lib/auth/login-access";
import { redirect } from "next/navigation";
import { OnboardingStepper } from "@/components/onboarding/stepper";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/onboarding");

  let access;
  try {
    access = await fetchLoginAccess(supabase);
  } catch {
    redirect("/login?error=tenant-access-check-failed");
  }

  const cookieStore = await cookies();
  const decision = resolveLoginAccess({
    access,
    savedOrganizationId: cookieStore.get("cervise_org")?.value ?? null,
  });

  if (decision.kind === "denied") redirect(`/login?error=${decision.reason}`);
  if (decision.destination !== "/onboarding") redirect(decision.destination);

  return <OnboardingStepper />;
}
