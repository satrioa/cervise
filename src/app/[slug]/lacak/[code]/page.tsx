import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicTenant } from "@/app/lacak/actions";
import { LacakForm } from "@/components/public/lacak-form";
import { PublicBackdrop } from "@/components/public/public-backdrop";

export const metadata: Metadata = {
  title: "Status Service",
  robots: { index: false, follow: false },
};

export default async function PublicTrackingCodePage({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const { slug, code } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) notFound();

  return (
    <main className="relative flex min-h-svh items-center justify-center bg-background px-4 py-12 text-foreground">
      <PublicBackdrop />
      <div className="relative w-full">
        <LacakForm tenant={tenant} initialCode={code} />
      </div>
    </main>
  );
}
