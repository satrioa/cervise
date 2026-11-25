import { MessageCircleIcon } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { WaOutboxTable, type OutboxRow } from "@/components/owner/wa-outbox-table";

const PAGE_SIZE = 25;
const STATES = ["pending", "sent", "failed", "skipped"] as const;
const EVENTS = ["servis_created", "servis_status", "shift_opened", "shift_closed"] as const;

type SearchParams = {
  state?: string;
  event?: string;
  q?: string;
  page?: string;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function cleanQuery(value: string | undefined) {
  return (value ?? "").replace(/[,()\\]/g, " ").trim().slice(0, 80);
}

export default async function OwnerNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const state = (STATES as readonly string[]).includes(params.state ?? "") ? params.state! : "";
  const event = (EVENTS as readonly string[]).includes(params.event ?? "") ? params.event! : "";
  const q = cleanQuery(params.q);
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.page ?? "1", 10) || 1));

  const admin = createAdminClient();
  const select = `id, created_at, sent_at, event, to_kind, to_status, state, attempts, next_attempt_at, last_error, provider_message_id, dedupe_key, payload, branch_id, branches(id, name, organizations(id, name))`;

  const base = admin.from("cervise_notification_outbox").select(select, { count: "exact" });
  if (state) base.eq("state", state);
  if (event) base.eq("event", event);
  if (q) base.or(`dedupe_key.ilike.%${q}%,provider_message_id.ilike.%${q}%,last_error.ilike.%${q}%`);

  const [{ data, count, error }, stateCounts] = await Promise.all([
    base.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    Promise.all(
      STATES.map(async (s) => {
        const { count: c } = await admin
          .from("cervise_notification_outbox")
          .select("id", { count: "exact", head: true })
          .eq("state", s);
        return { state: s, count: c ?? 0 };
      }),
    ),
  ]);

  if (error) throw error;

  const rows: OutboxRow[] = (data ?? []).map((row: any) => {
    const branch = one(row.branches);
    const org = one(branch?.organizations);
    const payload = row.payload && typeof row.payload === "object" ? row.payload : null;
    return {
      id: row.id,
      createdAt: row.created_at,
      sentAt: row.sent_at ?? null,
      event: row.event,
      toKind: row.to_kind,
      toStatus: row.to_status ?? null,
      state: row.state,
      attempts: row.attempts,
      nextAttemptAt: row.next_attempt_at,
      lastError: row.last_error ?? null,
      providerMessageId: row.provider_message_id ?? null,
      dedupeKey: row.dedupe_key,
      tenant: org?.name ?? "—",
      branch: branch?.name ?? "—",
      payload,
    };
  });

  const total = count ?? 0;
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          <MessageCircleIcon className="size-3.5" /> System
        </div>
        <h1 className="mt-1 font-heading text-3xl">Notifikasi WhatsApp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Antrean dan riwayat pesan WhatsApp: lihat yang pending, terkirim, dan gagal beserta alasannya.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-foreground/[0.02] px-4 py-3 text-xs text-muted-foreground">
        <MessageCircleIcon className="size-4 shrink-0" />
        Data dibaca langsung dari outbox notifikasi. Pesan gagal bersifat terminal dan tidak dikirim ulang otomatis.
      </div>
      <WaOutboxTable
        rows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        state={state}
        event={event}
        q={q}
        stateCounts={stateCounts}
      />
    </div>
  );
}
