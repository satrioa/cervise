import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenants } from "@/app/owner/actions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function TenantSelectorPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect("/login?next=/dashboard/tenant");
  }

  let tenants: Awaited<ReturnType<typeof getTenants>> = [];
  try {
    tenants = await getTenants();
  } catch {
    tenants = [];
  }

  if (tenants.length === 0) {
    redirect("/owner");
  }

  return (
    <div className="mx-auto max-w-4xl p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pilih Tenant</h1>
        <p className="text-sm text-muted-foreground">Tenant = Organization — pilih tenant untuk masuk ke dashboard operasional.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {tenants.map((t) => (
          <Card key={t.id} className="hover:bg-muted/20 transition-colors">
            <CardHeader>
              <CardTitle className="text-base">{t.name}</CardTitle>
              <CardDescription className="font-mono text-xs">{t.slug} · {t.paket}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">{t.cabangCount} cabang (Project)</div>
              <Button size="sm" asChild><Link href={`/dashboard/tenant/${t.slug}`}>Masuk</Link></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
