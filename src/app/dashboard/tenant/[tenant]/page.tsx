import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getTenantBySlugForCurrentUser } from "@/lib/supabase/actor";
import DashboardPage from "@/app/app/page";

export default async function TenantDashboardPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  // Centralized resolver: validates auth + slug + active employee membership, 404 if invalid/unauthorized
  const { organization } = await getTenantBySlugForCurrentUser(slug);

  // URL is canonical, update compatibility cookie to resolved org id (never override URL)
  const cookieStore = await cookies();
  cookieStore.set("cervise_org", organization.id, { path: "/", maxAge: 31536000 });

  // Render operational dashboard (reuse existing)
  // TenantProvider will pick up cookie on next client navigation, but we also pass via props implicitly
  return <DashboardPage />;
}
