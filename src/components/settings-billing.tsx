"use client";

import {
  ArrowDownToLineIcon,
  CheckCircle2Icon,
  CircleDollarSignIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  ZapIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const INVOICES = [
  { id: "INV-2026-04", date: "Apr 14, 2026", amount: "Rp 3.600.000", status: "paid" as const },
  { id: "INV-2026-03", date: "Mar 14, 2026", amount: "Rp 3.600.000", status: "paid" as const },
  { id: "INV-2026-02", date: "Feb 14, 2026", amount: "Rp 3.600.000", status: "paid" as const },
  { id: "INV-2026-01", date: "Jan 14, 2026", amount: "Rp 3.600.000", status: "paid" as const },
  { id: "INV-2025-12", date: "Dec 14, 2025", amount: "Rp 3.600.000", status: "paid" as const },
];

export function SettingsBillingShowcasePage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-8 py-12">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
          Settings · Billing
        </div>
        <h1 className="mt-1 font-heading text-3xl">Billing</h1>
        <p className="mt-1.5 text-muted-foreground text-sm">
          Plan, payment method, and invoice history.
        </p>

        <section className="mt-8 overflow-hidden rounded-xl border border-border/60 bg-background/40">
          <div className="flex items-center justify-between gap-6 p-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-2xl">Pro</span>
                <span className="rounded bg-foreground/[0.08] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em]">
                  Annual
                </span>
              </div>
              <p className="mt-1 text-muted-foreground text-sm">
                25 seats · unlimited projects · 1M API requests
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-emerald-500/10 px-2 py-1 font-mono text-[10px] text-emerald-700 uppercase tracking-[0.2em] dark:text-emerald-400">
                <CheckCircle2Icon className="size-3" />
                Active · renews May 14
              </div>
            </div>
            <div className="text-right">
              <div className="font-heading text-3xl">Rp 3.600.000</div>
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
                per month
              </div>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-3 p-4">
            <Button variant="ghost" size="sm">
              Compare plans
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                Cancel plan
              </Button>
              <Button size="sm">
                <ZapIcon />
                Upgrade
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-3 rounded-xl border border-border/60 bg-background/40 p-6">
          <header className="flex items-center justify-between">
            <h2 className="font-heading text-base">Payment method</h2>
            <Button size="sm" variant="ghost">
              Update
            </Button>
          </header>
          <div className="mt-4 flex items-center gap-4 rounded-lg border border-border/60 bg-background/40 p-4">
            <div className="flex size-10 items-center justify-center rounded-md bg-foreground text-background">
              <CreditCardIcon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Visa</span>
                <span className="font-mono text-muted-foreground text-sm">
                  •••• 4242
                </span>
              </div>
              <p className="mt-0.5 text-muted-foreground text-xs">
                Expires 09/27 · billing@acme.com
              </p>
            </div>
            <span className="rounded bg-foreground/[0.06] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.25em]">
              Default
            </span>
          </div>
        </section>

        <section className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CreditCard
            label="Credits"
            value="Rp 724.000"
            sub="Auto-applied to next invoice"
          />
          <CreditCard
            label="Tax ID"
            value="EU VAT"
            sub="ATU 88374521"
          />
          <CreditCard
            label="Currency"
            value="IDR"
            sub="Set per workspace — mengikuti Lokalisasi"
          />
        </section>

        <section className="mt-3 rounded-xl border border-border/60 bg-background/40">
          <header className="flex items-center justify-between p-5">
            <h2 className="font-heading text-base">Invoices</h2>
            <Button size="sm" variant="ghost">
              <ArrowDownToLineIcon />
              Export all
            </Button>
          </header>
          <Separator />
          <ul>
            {INVOICES.map((inv, i) => (
              <li
                key={inv.id}
                className={`flex items-center gap-4 px-5 py-3 text-sm ${
                  i < INVOICES.length - 1
                    ? "border-b border-border/40"
                    : ""
                } transition-colors hover:bg-foreground/[0.02]`}
              >
                <span className="font-mono text-[12px] text-muted-foreground">
                  {inv.id}
                </span>
                <span className="flex-1 text-muted-foreground">{inv.date}</span>
                <span className="font-mono">{inv.amount}</span>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2Icon className="size-2.5" />
                  Paid
                </span>
                <button
                  type="button"
                  className="ml-2 inline-flex items-center gap-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                  aria-label="Open"
                >
                  <ExternalLinkIcon className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function CreditCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
          {label}
        </div>
        <CircleDollarSignIcon className="size-3.5 opacity-40" />
      </div>
      <div className="mt-2 font-heading text-xl">{value}</div>
      <div className="mt-1 text-muted-foreground text-xs">{sub}</div>
    </div>
  );
}
