import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingStepper } from "@/components/onboarding/stepper";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/onboarding");
  const { data: emps } = await supabase.from("employees").select("id").eq("profile_id", auth.user.id).eq("is_active", true).limit(1);
  if (emps && emps.length > 0) redirect("/app");
  return <OnboardingStepper />;
}
