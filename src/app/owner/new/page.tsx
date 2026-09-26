import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { CreateTenantDialog } from "@/components/owner/create-tenant-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NewTenantPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Button variant="ghost" size="sm" asChild><Link href="/owner"><ArrowLeftIcon className="size-4" /> Kembali</Link></Button>
      <Card>
        <CardHeader><CardTitle>Buat Tenant Baru</CardTitle><CardDescription>Tenant baru mendapat trial 14 hari dan satu branch pusat secara otomatis.</CardDescription></CardHeader>
        <CardContent><CreateTenantDialog /></CardContent>
      </Card>
    </div>
  );
}
