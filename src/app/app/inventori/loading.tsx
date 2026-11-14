import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div role="status" aria-label="Memuat halaman" className="min-h-svh bg-transparent text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="mt-2 h-4 w-72 max-w-full" />
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs/5">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-full rounded-md sm:w-72" />
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-32 rounded-md" />
            <div className="ml-auto flex gap-1">
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="size-8 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-3.5 w-64 max-w-full" />
        </div>

        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-3.5 w-72 max-w-full" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Skeleton className="mb-2 h-2.5 w-56" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Array.from({ length: 2 }, (_, j) => (
                      <div key={j} className="flex gap-3 rounded-lg border bg-card p-3">
                        <Skeleton className="size-10 shrink-0 rounded-md" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-4 w-40 max-w-full" />
                          <Skeleton className="h-3 w-28" />
                          <div className="flex gap-2">
                            <Skeleton className="h-5 w-16 rounded-full" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}
