import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">C</div>
          <CardTitle className="mt-2">Masuk ke Cervise</CardTitle>
          <CardDescription>Email & password • 1 user 1 cabang</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" placeholder="master@cervise.id" type="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pass">Password</Label>
            <Input id="pass" type="password" placeholder="••••••••" />
          </div>
          <Link href="/app" className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Masuk</Link>
          <p className="text-center text-xs text-muted-foreground">
            Belum punya akun? <Link href="/" className="underline">Trial 14 hari gratis</Link> • Nanti OTP WA
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
