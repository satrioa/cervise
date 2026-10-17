"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { lookupServisByCode } from "@/app/lacak/actions";
import type { PublicTenant } from "@/lib/public/landing";
import { ServisResultCard } from "@/components/public/servis-result-card";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AlertTriangleIcon, SearchIcon } from "lucide-react";
import type { PublicServisResult } from "@/lib/public/lookup";

export function LacakForm({
  tenant,
  initialCode,
  preview = false,
}: {
  tenant: PublicTenant;
  initialCode?: string;
  /** Pratinjau di halaman Tampilan: form tetap tampil, tapi tidak memanggil API. */
  preview?: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode ?? "");
  const [result, setResult] = useState<PublicServisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (preview) return;

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
      <div className="rounded-2xl border bg-card p-[var(--lacak-pad-card)] shadow-xs/5">
        <form onSubmit={submit} className="space-y-[var(--lacak-gap)]">
          <div className="text-center">
            <h2 className="font-heading text-[length:var(--lacak-text-title)] font-bold tracking-tight">
              Lacak Progres Servis
            </h2>
            <p className="mt-1 text-[length:var(--lacak-text-body)] text-muted-foreground">
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
              {result ? "Cek lagi" : "Cari Servis"}
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
