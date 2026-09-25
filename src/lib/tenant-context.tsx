"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type Tenant = { id: string; name: string; paket: string; slug?: string | null };

type TenantContextValue = {
  tenants: Tenant[];
  activeOrgId: string | null;
  setActiveOrg: (id: string) => void;
  loading: boolean;
};

const TenantContext = React.createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const params = useParams() as Record<string, string | string[]> | null;
  const routeTenantSlug = (() => {
    const t = (params as any)?.tenant;
    if (!t) return null;
    const s = Array.isArray(t) ? t[0] : t;
    return typeof s === "string" ? s : null;
  })();
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [activeOrgId, setActiveOrgIdState] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setLoading(false); return; }
      const { data: emps } = await supabase.from("employees").select("organization_id").eq("profile_id", auth.user.id).eq("is_active", true);
      const orgIds = [...new Set((emps ?? []).map((e: any) => e.organization_id).filter(Boolean))] as string[];
      // also include orgs created by user
      const { data: owned } = await supabase.from("organizations").select("id, name, paket, slug").eq("created_by", auth.user.id);
      for (const o of (owned ?? []) as any[]) if (!orgIds.includes(o.id)) orgIds.push(o.id);
      if (orgIds.length === 0) { setLoading(false); return; }
      const { data: orgs } = await supabase.from("organizations").select("id, name, paket, slug").in("id", orgIds);
      const list = (orgs ?? []).map((o: any) => ({ id: o.id as string, name: o.name as string, paket: (o.paket as string) ?? "trial", slug: (o as any).slug as string | null }));
      setTenants(list as any);
      // For tenant-specific routes, prioritize URL slug over cookie (do not fallback to first tenant)
      if (routeTenantSlug) {
        const foundBySlug = list.find((t: any) => (t as any).slug === routeTenantSlug);
        if (foundBySlug) {
          setActiveOrgIdState(foundBySlug.id);
          // update cookie to canonical tenant for compatibility, but do not use cookie as auth source
          document.cookie = `cervise_org=${encodeURIComponent(foundBySlug.id)}; path=/; max-age=31536000`;
          localStorage.setItem("cervise_org", foundBySlug.id);
          setLoading(false);
          return;
        }
        // slug not found or not authorized -> do not fallback, keep null to allow page to handle notFound
        setActiveOrgIdState(null);
        setLoading(false);
        return;
      }
      // legacy fallback for non-tenant routes: restore active from cookie/localStorage or first
      const saved = typeof window !== "undefined" ? (document.cookie.match(/(?:^|; )cervise_org=([^;]*)/)?.[1] ?? localStorage.getItem("cervise_org")) : null;
      const decoded = saved ? decodeURIComponent(saved) : null;
      const found = decoded ? list.find((t) => t.id === decoded) : null;
      const active = found ? found.id : list[0]?.id ?? null;
      setActiveOrgIdState(active);
      if (active) {
        document.cookie = `cervise_org=${encodeURIComponent(active)}; path=/; max-age=31536000`;
        localStorage.setItem("cervise_org", active);
      }
      setLoading(false);
    };
    load();
  }, [routeTenantSlug]);

  const setActiveOrg = React.useCallback((id: string) => {
    setActiveOrgIdState(id);
    if (typeof window !== "undefined") {
      document.cookie = `cervise_org=${encodeURIComponent(id)}; path=/; max-age=31536000`;
      localStorage.setItem("cervise_org", id);
      window.dispatchEvent(new CustomEvent("cervise-org-change", { detail: id }));
      // also trigger refresh to reload tenant-scoped data
      window.location.reload();
    }
  }, []);

  const value = React.useMemo(() => ({ tenants, activeOrgId, setActiveOrg, loading }), [tenants, activeOrgId, setActiveOrg, loading]);
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = React.useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}

export function useTenantOptional() {
  return React.useContext(TenantContext);
}
