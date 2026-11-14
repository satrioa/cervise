import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div role="status" aria-label="Memuat halaman" className="min-h-svh bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-2 sm:px-6 lg:px-8 pb-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            {Array.from({ length: 3 }, (_, i) => (
              <Card key={i}>
                <CardHeader className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-3.5 w-64 max-w-full" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {Array.from({ length: 2 }, (_, j) => (
                    <div key={j} className="space-y-2">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="h-fit">
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3.5 w-48 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-40 max-w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}
