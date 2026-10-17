import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicTenant } from "@/app/lacak/actions";
import { LacakPage } from "@/components/public/lacak-shell";

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

  return <LacakPage tenant={tenant} initialCode={code} />;
}
