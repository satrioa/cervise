import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ServisDetailView } from "@/components/servis/servis-detail-view";
import { getServisDetail } from "@/app/app/servis/actions";
import { ChevronLeftIcon } from "lucide-react";
import { format } from "date-fns";

function formatInvoiceNo(createdAt: string | null, id: string) {
  try {
    const d = createdAt ? new Date(createdAt) : new Date();
    return `INV-${format(d, "ddMMyyyyHHmmss")}`;
  } catch {
    return `INV-${id.slice(0, 8).toUpperCase()}`;
  }
}

export default async function ServisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data: Awaited<ReturnType<typeof getServisDetail>> | null = null;
  try {
    data = await getServisDetail(id);
  } catch {
    notFound();
  }
  if (!data) notFound();
  const invoiceNo = formatInvoiceNo(data.created_at as any, data.id);

  return (
    <div className="bg-background text-foreground min-h-svh">
      <div className="border-b border-border/60 px-4 sm:px-6 lg:px-10 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Link href="/app/servis">
            <Button variant="ghost" size="icon-sm" aria-label="Kembali">
              <ChevronLeftIcon className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Servis · Detail</div>
            <h1 className="font-heading text-xl">Detail {invoiceNo}</h1>
          </div>
          <div className="ml-auto flex gap-2">
            <Link href="/app/servis">
              <Button variant="outline" size="sm">Kembali ke list</Button>
            </Link>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-10 py-6">
        <ServisDetailView data={data} />
      </div>
    </div>
  );
}
