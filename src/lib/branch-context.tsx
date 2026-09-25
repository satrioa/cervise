"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export type Branch = {
  id: string;
  label: string;
  meta: string;
};

export const BRANCHES: Branch[] = [
  { id: "all", label: "Semua cabang", meta: "Semua cabang · live" },
];

type BranchContextValue = {
  branch: Branch;
  setBranch: (b: Branch) => void;
  branches: Branch[];
};

const BranchContext = React.createContext<BranchContextValue | null>(null);

function getActiveOrgId(): string | null {
  if (typeof window === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )cervise_org=([^;]*)/);
  if (m) return decodeURIComponent(m[1]);
  return localStorage.getItem("cervise_org");
}

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = React.useState<Branch[]>(BRANCHES);
  const [branch, setBranchState] = React.useState<Branch>(BRANCHES[0]);

  // fetch real branches for active tenant
  React.useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const orgId = getActiveOrgId();
      if (!orgId) {
        // fallback to all hardcoded if no tenant yet (owner page)
        setBranches(BRANCHES);
        return;
      }
      const { data: rows } = await supabase.from("branches").select("id, name, city").eq("organization_id", orgId).eq("is_active", true).order("name");
      if (rows && rows.length) {
        const mapped: Branch[] = (rows as any[]).map((r) => ({ id: r.id as string, label: r.name as string, meta: (r.city as string) || "Project" }));
        // keep "Semua cabang" on top if multiple
        const all = mapped.length > 1 ? BRANCHES.slice(0, 1).concat(mapped) : mapped;
        setBranches(all);
        const saved = localStorage.getItem("cervise-branch");
        const found = saved ? all.find((b) => b.id === saved) : null;
        if (found) setBranchState(found);
        else if (all.length) setBranchState(all[0]);
      } else {
        setBranches(BRANCHES);
      }
    };
    load();
    const onOrgChange = () => load();
    window.addEventListener("cervise-org-change", onOrgChange);
    return () => window.removeEventListener("cervise-org-change", onOrgChange);
  }, []);

  // persist in localStorage
  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("cervise-branch") : null;
    if (saved) {
      const found = branches.find((b) => b.id === saved);
      if (found) setBranchState(found);
    }
  }, [branches]);

  const setBranch = React.useCallback((b: Branch) => {
    setBranchState(b);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("cervise-branch", b.id);
      document.cookie = `cervise_branch=${encodeURIComponent(b.id)}; path=/; max-age=31536000`;
      window.dispatchEvent(new CustomEvent("cervise-branch-change", { detail: b }));
    }
  }, []);

  // listen for external changes (e.g., from other tabs)
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cervise-branch" && e.newValue) {
        const found = branches.find((b) => b.id === e.newValue);
        if (found) setBranchState(found);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [branches]);

  const value = React.useMemo(() => ({ branch, setBranch, branches }), [branch, setBranch, branches]);
  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch() {
  const ctx = React.useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used within BranchProvider");
  return ctx;
}

export function useBranchOptional() {
  return React.useContext(BranchContext);
}
