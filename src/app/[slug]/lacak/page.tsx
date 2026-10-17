import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicTenant } from "@/app/lacak/actions";
import { LacakPage } from "@/components/public/lacak-shell";

export const metadata: Metadata = {
  title: "Lacak Service",
  robots: { index: false, follow: false },
};

export default async function PublicTrackingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) notFound();

  return <LacakPage tenant={tenant} />;
}
