import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PlatformActor = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string;
  role: "owner" | "billing_admin";
};

export async function requirePlatformAdmin(): Promise<PlatformActor> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    redirect("/login?next=/owner");
  }

  const { data: admin, error } = await supabase
    .from("platform_admins")
    .select("profile_id, role")
    .eq("profile_id", auth.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error("Gagal memverifikasi akses platform admin");
  }

  if (!admin) {
    redirect("/login?error=platform-admin-required");
  }

  return {
    supabase,
    userId: auth.user.id,
    email: auth.user.email ?? "",
    role: admin.role as PlatformActor["role"],
  };
}
