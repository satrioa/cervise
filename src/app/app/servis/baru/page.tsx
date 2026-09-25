import { ServisForm } from "@/components/servis/servis-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export default function BaruServisPage() {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <PageHeader
        title="Tambah Servis"
        innerClassName="max-w-3xl"
        actions={
          <Link href="/app/servis">
            <Button variant="ghost" size="icon-sm" aria-label="Kembali">
              <ChevronLeftIcon className="size-4" />
            </Button>
          </Link>
        }
      />
      <ServisForm />
    </div>
  );
}
