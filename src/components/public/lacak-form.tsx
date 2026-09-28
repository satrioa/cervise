"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { lookupServisByCode, type PublicTenant } from "@/app/lacak/actions";
import { ServisResultCard } from "@/components/public/servis-result-card";
import { TenantBadge } from "@/components/public/tenant-badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AlertTriangleIcon, SearchIcon } from "lucide-react";
import type { PublicServisResult } from "@/lib/public/lookup";

export function LacakForm({ tenant, initialCode }: { tenant: PublicTenant; initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode ?? "");
  const [result, setResult] = useState<PublicServisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await lookupServisByCode(tenant.slug, code);
      if (response.ok) {
        setResult(response.result);
        setError(null);
        return;
      }
      setResult(null);
      setError(response.message);
    });
  };

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <TenantBadge name={tenant.name} logoUrl={tenant.logoUrl} branchName={tenant.branchName} />

      <div className="mt-6 rounded-2xl border bg-card p-5 shadow-xs/5">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Cek service</span>
            <h1 className="mt-1 font-heading text-2xl tracking-tight">Lacak status service</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Masukkan kode yang tertera di struk service Anda untuk melihat status perbaikan dan masa garansi.
            </p>
          </div>

          <Field>
            <FieldLabel htmlFor="tracking-code">Kode cek service</FieldLabel>
            <Input
              id="tracking-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="A3KD9-F2M4B"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              className="font-mono"
            />
          </Field>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="lg" loading={pending} disabled={pending || code.trim().length === 0}>
              <SearchIcon className="size-4" />
              {result ? "Cek lagi" : "Cek status"}
            </Button>
            {result ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setResult(null);
                  setError(null);
                  router.replace(`/${tenant.slug}/lacak`);
                }}
              >
                Reset
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      {result ? (
        <div className="mt-4">
          <ServisResultCard result={result} />
        </div>
      ) : null}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Simpan struk service Anda. Kode di struk ini dipakai untuk cek status tanpa perlu akun.
      </p>
    </div>
  );
}
