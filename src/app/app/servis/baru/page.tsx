import { ServisForm } from "@/components/servis/servis-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon } from "lucide-react";

export default function BaruServisPage() {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <div className="border-b border-border/60 px-4 sm:px-6 lg:px-10 py-4">
        <div className="mx-auto max-w-3xl flex items-center gap-3">
          <Link href="/app/servis">
            <Button variant="ghost" size="icon-sm" aria-label="Kembali">
              <ChevronLeftIcon className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Servis · Baru</div>
            <h1 className="font-heading text-xl">Tambah Servis</h1>
          </div>
        </div>
      </div>
      <ServisForm />
    </div>
  );
}
