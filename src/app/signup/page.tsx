import { getTrialDays } from "@/lib/pricing/public";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const trialDays = await getTrialDays();
  return <SignupForm trialDays={trialDays} />;
}
