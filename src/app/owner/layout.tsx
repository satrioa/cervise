import { requirePlatformAdmin } from "@/lib/platform/auth";
import { OwnerShell } from "@/components/owner/owner-shell";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePlatformAdmin();
  return <OwnerShell email={actor.email}>{children}</OwnerShell>;
}
