import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div role="status" aria-label="Memuat halaman" className="min-h-svh bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-8 py-5">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-[28rem] max-w-full" />
      </div>
      <div className="mx-auto max-w-6xl px-8 py-4">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            {Array.from({ length: 3 }, (_, i) => (
              <Card key={i}>
                <CardHeader className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3.5 w-72 max-w-full" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {Array.from({ length: 6 }, (_, j) => (
                      <Skeleton key={j} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-9 w-full max-w-sm" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-center lg:justify-end">
            <Skeleton className="h-[620px] w-[300px] rounded-[3rem]" />
          </div>
        </div>
      </div>
      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}
