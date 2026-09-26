import { PackageIcon } from "lucide-react";
import { getPackages } from "../actions";
import { PackageManager } from "@/components/owner/package-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OwnerPackagesPage() {
  const packages = await getPackages();
  return <div className="mx-auto max-w-7xl space-y-6"><div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground"><PackageIcon className="size-3.5" /> Catalog</div><h1 className="mt-1 font-heading text-3xl">Packages</h1><p className="mt-1 text-sm text-muted-foreground">Atur harga bulanan, branch limit, dan user limit.</p></div><Card className="bg-transparent shadow-none"><CardHeader><CardTitle className="text-base">Pricing packages</CardTitle><CardDescription>Perubahan harga berlaku untuk invoice baru; invoice lama tetap memakai nominal snapshot.</CardDescription></CardHeader><CardContent><PackageManager packages={packages} /></CardContent></Card></div>;
}
