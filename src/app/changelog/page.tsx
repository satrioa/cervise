import Link from "next/link";
import type { Viewport } from "next";
import { ArrowLeftIcon, HistoryIcon } from "lucide-react";
import { ReleaseCard } from "@/components/changelog/release-card";
import { Button } from "@/components/ui/button";
import { releases } from "@/lib/changelog";

// Halaman publik ini memakai scope terang yang sama dengan landing.
export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function ChangelogPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground landing-light">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeftIcon className="size-4" /> Beranda</Link>
          </Button>
          <Link href="/" className="font-heading font-semibold">Kaggo</Link>
        </div>

        <div className="mt-10 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          <HistoryIcon className="size-3.5" /> Product updates
        </div>
        <h1 className="mt-2 font-heading text-3xl sm:text-4xl">Changelog</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Catatan pembaruan Kaggo, ditampilkan dari rilis terbaru ke yang terlama.
        </p>

        <div className="mt-8 space-y-6">
          {releases.map((release) => (
            <ReleaseCard key={release.version} release={release} />
          ))}
        </div>
      </div>
    </div>
  );
}
