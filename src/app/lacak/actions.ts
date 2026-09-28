"use server";

import { headers } from "next/headers";
import { garansiMeta } from "@/lib/operational/garansi-meta";
import { coerceStage, normalizeTrackingCode, PUBLIC_LOOKUP_RATE_LIMIT_MESSAGE, PUBLIC_LOOKUP_UNAVAILABLE_MESSAGE, PUBLIC_SERVICE_SELECT, type PublicServisHistoryEntry, type PublicServisLookup, type PublicServisResult } from "@/lib/public/lookup";
import { createAdminClient } from "@/lib/supabase/admin";

const RATE_LIMIT_MAX_HITS = 20;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const HISTORY_LIMIT = 6;
const ACTIVE_TENANT_STATUSES = ["trial", "active", "grace"];

/** Hash non-kriptografis (FNV-1a 64-bit): ini pembatas request, bukan rahasia. */
function hashKey(value: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

async function callerIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headerList.get("x-real-ip") ?? "unknown";
}

async function allowAttempt(slug: string, ip: string): Promise<boolean> {
  const admin = createAdminClient();
  const key = `look:${slug}:${hashKey(ip)}`;
  const now = Date.now();

  const { data: current, error } = await admin
    .from("public_rate_limits")
    .select("window_start, hits")
    .eq("key", key)
    .maybeSingle();
  if (error) return false;

  if (!current) {
    const { error: insertError } = await admin
      .from("public_rate_limits")
      .insert({ key, window_start: new Date(now).toISOString(), hits: 1 });
    return !insertError;
  }

  const windowStart = new Date(current.window_start).getTime();
  if (!Number.isFinite(windowStart) || now - windowStart > RATE_LIMIT_WINDOW_MS) {
    const { error: resetError } = await admin
      .from("public_rate_limits")
      .update({ window_start: new Date(now).toISOString(), hits: 1 })
      .eq("key", key);
    return !resetError;
  }

  if (current.hits >= RATE_LIMIT_MAX_HITS) return false;

  const { error: bumpError } = await admin
    .from("public_rate_limits")
    .update({ hits: current.hits + 1 })
    .eq("key", key);
  return !bumpError;
}

export type PublicTenant = {
  name: string;
  slug: string;
  logoUrl: string | null;
  branchName: string | null;
};

type BranchRef = { id: string; name: string; logo_url?: string | null };
type TechnicianRef = { full_name: string | null };

type OrganizationRow = {
  name: string;
  slug: string;
  branches: BranchRef[] | null;
};

type ServiceRow = {
  id: string | null;
  service_number: string | null;
  device: string | null;
  status: string | null;
  created_at: string | null;
  garansi_value: number | null;
  garansi_unit: string | null;
  garansi_until: string | null;
  branches: BranchRef | null;
  profiles: TechnicianRef | null;
};

type ServiceLogRow = {
  action: string | null;
  from_value: string | null;
  to_value: string | null;
  created_at: string | null;
};

/**
 * Select di bawah memakai string dinamis, jadi PostgREST tidak bisa
 * menginferensikan tipe barisnya. Bentuk baris dideklarasikan eksplisit di
 * atas supaya tidak ada `any` yang lolos ke logika output.
 */
function asRow<T>(value: unknown): T {
  return value as T;
}

/**
 * Dipakai server component halaman publik. Sengaja tidak memakai
 * getActiveTenant(): pengunjung tidak punya sesi, dan anon tidak punya akses
 * ke tabel branding, jadi satu-satunya jalur adalah service role.
 */
export async function getPublicTenant(slug: string): Promise<PublicTenant | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("id, name, slug, status, branches(id, name, logo_url)")
    .eq("slug", normalized)
    .in("status", ACTIVE_TENANT_STATUSES)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;

  const row = asRow<OrganizationRow>(data);
  const branches = row.branches ?? [];
  const withLogo = branches.find((branch) => Boolean(branch.logo_url)) ?? branches[0] ?? null;

  return {
    name: row.name,
    slug: row.slug,
    logoUrl: withLogo?.logo_url ?? null,
    branchName: withLogo?.name ?? null,
  };
}

export async function lookupServisByCode(slug: string, rawCode: string): Promise<PublicServisLookup> {
  const code = normalizeTrackingCode(rawCode);
  if (!code) return { ok: false, message: PUBLIC_LOOKUP_UNAVAILABLE_MESSAGE };

  const ip = await callerIp();
  if (!(await allowAttempt(slug.trim().toLowerCase(), ip))) {
    return { ok: false, message: PUBLIC_LOOKUP_RATE_LIMIT_MESSAGE };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cervise_services")
    .select(PUBLIC_SERVICE_SELECT)
    .eq("tracking_code", code)
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, message: PUBLIC_LOOKUP_UNAVAILABLE_MESSAGE };
  if (!data) return { ok: false, message: PUBLIC_LOOKUP_UNAVAILABLE_MESSAGE };

  const row = asRow<ServiceRow>(data);
  const servisId = row.id;

  const { data: logRows } = servisId
    ? await admin
        .from("cervise_service_logs")
        .select("action, from_value, to_value, created_at")
        .eq("servis_id", servisId)
        .eq("action", "status_change")
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT)
    : { data: [] };

  const history: PublicServisHistoryEntry[] = asRow<ServiceLogRow[]>(logRows ?? [])
    .filter((log) => Boolean(log.created_at))
    .map((log) => ({
      at: log.created_at as string,
      from: log.from_value ?? null,
      to: log.to_value ?? null,
    }));

  const result: PublicServisResult = {
    serviceNumber: row.service_number ?? null,
    trackingCode: code,
    device: row.device ?? "",
    status: coerceStage(row.status),
    createdAt: row.created_at ?? "",
    branchName: row.branches?.name ?? "—",
    teknisiName: row.profiles?.full_name ?? null,
    garansiUntil: row.garansi_until ?? null,
    garansi: garansiMeta({
      garansiUntil: row.garansi_until ?? null,
      garansiValue: Number(row.garansi_value ?? 0),
      garansiUnit: row.garansi_unit ?? "hari",
    }),
    history,
  };

  return { ok: true, result };
}
