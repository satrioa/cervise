import { ShieldAlertIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function AssignmentRequiredPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/account/assignment-required");

  return <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12 text-foreground"><Card className="w-full max-w-md"><CardHeader><div className="flex size-10 items-center justify-center rounded-xl bg-warning/10 text-warning-foreground"><ShieldAlertIcon className="size-5" /></div><CardTitle className="mt-4">Assignment tenant perlu ditinjau</CardTitle><CardDescription>Akun ini memiliki lebih dari satu assignment tenant. Hubungi platform owner untuk menentukan tenant dan cabang yang aktif.</CardDescription></CardHeader><CardContent><p className="text-sm text-muted-foreground">Untuk mencegah akses ke tenant yang salah, Cervise tidak memilih tenant secara otomatis.</p></CardContent></Card></main>;
}
