import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getActiveTenant } from "@/lib/supabase/actor";
import { getSession } from "../actions";
import { OpnameCountClient } from "./opname-count-client";

export default async function OpnameSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: Awaited<ReturnType<typeof getSession>>;
  try {
    data = await getSession(id);
  } catch {
    notFound();
  }
  const actor = await getActiveTenant();
  const canPost = ["MASTER_ADMIN", "ADMIN"].includes(actor.role);

  return (
    <div className="min-h-svh bg-transparent text-foreground">
      <PageHeader
        title="Hitung Stok"
        titleClassName="font-heading text-2xl"
        description={data.session.note ?? `Sesi ${data.session.domain} · ${data.session.status}`}
      />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <OpnameCountClient session={data.session} lines={data.lines} canPost={canPost} />
      </main>
    </div>
  );
}
