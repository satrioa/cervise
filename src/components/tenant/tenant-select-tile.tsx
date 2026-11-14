"use client";

import { useRef } from "react";
import { beginTenantTransition } from "@/components/layout/page-transition";

export function TenantSelectTile({
  organizationId,
  name,
  logoUrl,
  initial,
  action,
}: {
  organizationId: string;
  name: string;
  logoUrl: string | null;
  initial: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="flex">
      <input type="hidden" name="organizationId" value={organizationId} />
      <button
        type="submit"
        onClick={() => beginTenantTransition()}
        className="group flex h-full min-h-[152px] w-32 flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-accent/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-36"
      >
        <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-xl font-semibold text-primary ring-1 ring-inset ring-primary/15 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote tenant logo URL, no remotePatterns config required
            <img src={logoUrl} alt="" className="size-full object-cover" />
          ) : (
            initial
          )}
        </span>
        <span className="line-clamp-2 text-sm font-medium leading-snug">{name}</span>
      </button>
    </form>
  );
}
