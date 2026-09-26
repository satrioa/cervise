"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getTrialProgress } from "@/lib/billing/trial";
import { Button } from "@/components/ui/button";

type TrialPackage = {
  name: string;
  branch_limit: number;
  user_limit: number | null;
};

type TrialRow = {
  status: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  package: TrialPackage | TrialPackage[] | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function TrialCard({
  organizationId,
  canManageSubscription,
}: {
  organizationId: string | null;
  canManageSubscription: boolean;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [row, setRow] = useState<TrialRow | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    const supabase = createClient();
    const load = async () => {
      const { data, error } = await supabase
        .from("tenant_subscriptions")
        .select("status, trial_started_at, trial_ends_at, package:packages!inner(name, branch_limit, user_limit)")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setFailed(true);
        return;
      }
      setFailed(false);
      setRow(data as TrialRow | null);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [organizationId, pathname]);

  if (!organizationId || failed || !row) return null;
  if (row.status !== "trial") return null;

  const progress = getTrialProgress({
    now: new Date(),
    startedAt: row.trial_started_at ? new Date(row.trial_started_at) : null,
    endsAt: row.trial_ends_at ? new Date(row.trial_ends_at) : null,
  });
  if (!progress || progress.isExpired) return null;

  const pkg = firstRelation(row.package);
  const branches = pkg?.branch_limit ?? 1;
  const users = pkg?.user_limit ?? "–";

  return (
    <div className="shrink-0 border-t border-border/60 p-3">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-zinc-100 shadow-sm">
        <div className="text-xs font-semibold tracking-tight">{t("trial.title", { days: progress.remainingDays })}</div>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          {t("trial.subtitle", { branches, users })}
        </p>
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            <span>{t("trial.remaining", { days: progress.remainingDays })}</span>
            <span>{progress.elapsedPercent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="relative h-full overflow-hidden rounded-full bg-emerald-500"
              style={{ width: `${progress.elapsedPercent}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent" style={{ animation: "shimmer 1.6s linear infinite" }} />
            </div>
          </div>
        </div>
        {canManageSubscription ? (
          <Button
            variant="candy"
            size="sm"
            className="mt-3 w-full h-7 text-xs font-medium"
            style={
              {
                "--btn": "oklch(0.99 0.015 85)",
                "--btn-hover": "oklch(0.96 0.02 85)",
                "--btn-fg": "oklch(0.22 0 0)",
              } as React.CSSProperties
            }
            render={<Link href="/app/pengaturan/subscription">{t("trial.viewPackage")}</Link>}
          />
        ) : null}
      </div>
    </div>
  );
}
