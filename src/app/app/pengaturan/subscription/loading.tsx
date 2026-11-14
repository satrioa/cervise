import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div role="status" aria-label="Memuat halaman" className="min-h-svh bg-background">
      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:px-8">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-2 sm:px-6 lg:px-8 pb-10">
        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-10 w-full max-w-md rounded-md" />
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-7 w-36" />
                <Skeleton className="h-3.5 w-48 max-w-full" />
              </CardHeader>
              <CardContent className="space-y-2">
                {Array.from({ length: 4 }, (_, j) => (
                  <Skeleton key={j} className="h-3.5 w-full" />
                ))}
                <Skeleton className="mt-3 h-9 w-full rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3.5 w-56 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}
