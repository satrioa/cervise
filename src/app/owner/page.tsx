import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getTenants } from "./actions";
import { CreateTenantDialog } from "@/components/owner/create-tenant-dialog";

export default async function OwnerDashboard() {
  let tenants: Awaited<ReturnType<typeof getTenants>> = [];
  try { tenants = await getTenants(); } catch { tenants = []; }
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cervise Owner</h1>
          <p className="text-sm text-muted-foreground">Kelola tenant Anda.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary">Manual</Badge>
          <CreateTenantDialog />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Tenant</CardTitle>
          <CardDescription>Daftar tenant yang Anda kelola.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Owner (Master-admin)</TableHead>
                <TableHead>Paket</TableHead>
                <TableHead>Trial Ends</TableHead>
                <TableHead>Cabang (Project)</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Belum ada tenant — klik Buat Tenant. Daftar → Tenant → Branch → Employee.</TableCell></TableRow>
              ) : (
                tenants.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="font-mono text-xs">{t.owner}</TableCell>
                    <TableCell><Badge variant={t.paket === "pro" ? "default" : t.paket === "basic" ? "secondary" : "outline"} className="capitalize">{t.paket}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString("id-ID") : "—"}</TableCell>
                    <TableCell>{t.cabangCount}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" asChild><Link href={`/dashboard/tenant/${t.slug}`}>Masuk</Link></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
