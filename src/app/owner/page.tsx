import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export default function OwnerDashboard() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cervise Owner — Super Admin</h1>
          <p className="text-sm text-muted-foreground">Kelola semua tenant, paket & billing manual WA.</p>
        </div>
        <Badge className="bg-primary">SaaS Owner</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tenant</CardDescription>
            <CardTitle>12</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">9 aktif, 3 trial</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Cabang</CardDescription>
            <CardTitle>18</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Across all tenants</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>MRR</CardDescription>
            <CardTitle>Rp 3,1jt</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-emerald-600">Manual transfer WA</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Trial Expiring</CardDescription>
            <CardTitle>4</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-amber-600">Follow-up WA</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Tenant</CardTitle>
          <CardDescription>Klik untuk lihat cabang & kelola paket Trial/Basic/Pro</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Toko</TableHead>
                <TableHead>Owner (Master-admin)</TableHead>
                <TableHead>Paket</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Cervise Pusat</TableCell>
                <TableCell>master@cervise.id</TableCell>
                <TableCell>
                  <Badge>Pro</Badge>
                </TableCell>
                <TableCell>3</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline">
                    Kelola
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
