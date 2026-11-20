import { requirePlatformAdmin } from "@/lib/platform/auth";
import { OwnerShell } from "@/components/owner/owner-shell";
import { publicPhotoUrl } from "@/lib/photos";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePlatformAdmin();
  const { data: profile } = await actor.supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", actor.userId)
    .maybeSingle();
  const avatarUrl = publicPhotoUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", (profile?.avatar_url as string | null) ?? null);

  return <OwnerShell email={actor.email} avatarUrl={avatarUrl}>{children}</OwnerShell>;
}
