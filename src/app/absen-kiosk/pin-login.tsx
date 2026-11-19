"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PinField } from "@/components/p-otp-field-2";
import { loginWithPin } from "./actions";

export function PinLogin() {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-5 px-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Kaggo · Absensi</p>
        <h1 className="font-heading text-2xl font-semibold">Masuk absensi</h1>
        <p className="text-sm text-muted-foreground">Gunakan email & PIN 6 digit yang diberikan admin.</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            // OTPField menyimpan PIN di input hidden bernama "pin" di dalam form.
            const form = new FormData(e.currentTarget);
            try {
              await loginWithPin(form);
              window.location.reload();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Gagal masuk");
            }
          });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <PinField />
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? "Memeriksa..." : "Masuk"}
        </Button>
      </form>
    </main>
  );
}
