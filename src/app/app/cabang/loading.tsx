import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <div role="status" aria-label="Memuat halaman" className="min-h-svh bg-background">
      <div className="mx-auto max-w-2xl px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="mt-2 h-4 w-56 max-w-full" />
          </div>
          <Skeleton className="h-9 w-32 shrink-0 rounded-md" />
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="mx-auto max-w-2xl space-y-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <Skeleton className="h-2.5 w-32" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3.5 w-56 max-w-full" />
                  <div className="flex flex-wrap gap-1.5">
                    <Skeleton className="h-5 w-20 rounded border" />
                    <Skeleton className="h-5 w-28 rounded border" />
                  </div>
                  <Skeleton className="h-3 w-32" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Skeleton className="h-2.5 w-10" />
                  <Skeleton className="h-5 w-9 rounded-full" />
                  <Skeleton className="h-7 w-16 rounded-md" />
                </div>
              </div>
            </Card>
          ))}
          <div className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 p-4">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </div>
      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}
