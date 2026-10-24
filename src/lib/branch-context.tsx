"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setBranchScope } from "@/app/app/actions/branch-scope";
import { sfx } from "@/lib/sound";

export type Branch = {
  id: string;
  label: string;
  meta: string;
  phone?: string | null;
};

/**
 * "Semua cabang" bukan cabang sungguhan. Entri ini hanya muncul saat tenant
 * punya lebih dari satu cabang, dan pilihannya disimpan di server sebagai
 * mode baca-saja (`cervise_scope=all`).
 */
export const ALL_BRANCH: Branch = {
  id: "all",
  label: "Semua cabang",
  meta: "Semua cabang · live",
};

export const BRANCHES: Branch[] = [ALL_BRANCH];

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

function decorate(realBranches: Branch[]): Branch[] {
  return realBranches.length > 1 ? [ALL_BRANCH, ...realBranches] : realBranches;
}

function pickInitial(
  branches: Branch[],
  scope: string | null | undefined,
  fixedBranchId: string | null,
): Branch {
  if (fixedBranchId) {
    return { id: fixedBranchId, label: "Cabang assigned", meta: "Assigned branch" };
  }
  if (scope && scope !== "all") {
    const byId = branches.find((b) => b.id === scope);
    if (byId) return byId;
  }
  if (scope === "all") {
    const all = branches.find((b) => b.id === ALL_BRANCH.id);
    if (all) return all;
  }
  return branches[0] ?? ALL_BRANCH;
}

export function BranchProvider({
  children,
  fixedBranchId = null,
  initialBranches = null,
  initialScope = null,
}: {
  children: React.ReactNode;
  fixedBranchId?: string | null;
  /** Cabang aktif dari server. Dipakai supaya label tidak berkedip/keliru. */
  initialBranches?: Branch[] | null;
  /** Scope aktif dari server: `all` atau id cabang. */
  initialScope?: string | null;
}) {
  const router = useRouter();
  const hasServerBranches = Boolean(initialBranches && initialBranches.length > 0);

  const seeded = React.useMemo(() => {
    if (fixedBranchId) {
      return [pickInitial([], initialScope, fixedBranchId)];
    }
    return decorate(initialBranches ?? []);
  }, [fixedBranchId, initialBranches, initialScope]);

  const [branches, setBranches] = React.useState<Branch[]>(fixedBranchId ? [] : seeded);
  const [branch, setBranchState] = React.useState<Branch>(() =>
    pickInitial(seeded, initialScope, fixedBranchId),
  );

  React.useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      if (fixedBranchId) {
        const { data: fixedBranch } = await supabase
          .from("branches")
          .select("id, name, city, phone")
          .eq("id", fixedBranchId)
          .eq("is_active", true)
          .maybeSingle();
        if (fixedBranch) {
          const mapped: Branch = {
            id: fixedBranch.id as string,
            label: fixedBranch.name as string,
            meta: (fixedBranch.city as string) || "Cabang assigned",
            phone: (fixedBranch.phone as string | null) ?? null,
          };
          setBranches([mapped]);
          setBranchState(mapped);
        }
        return;
      }

      // Server sudah mengirim daftar cabang untuk request ini; tidak perlu
      // fetch ulang dan tidak ada jendela saat UI salah menampilkan cabang.
      if (hasServerBranches) return;

      const orgId = getActiveOrgId();
      if (!orgId) {
        setBranches(BRANCHES);
        return;
      }
      const { data: rows } = await supabase
        .from("branches")
        .select("id, name, city, phone")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("name");
      if (rows && rows.length) {
        const mapped: Branch[] = (rows as {
          id: string;
          name: string;
          city: string | null;
          phone: string | null;
        }[]).map((row) => ({
          id: row.id,
          label: row.name,
          meta: row.city || "Project",
          phone: row.phone ?? null,
        }));
        const all = decorate(mapped);
        setBranches(all);
        const saved = localStorage.getItem("cervise-branch");
        const found = saved ? all.find((b) => b.id === saved) : null;
        setBranchState(found ?? all[0]);
      } else {
        setBranches(BRANCHES);
      }
    };
    load();
    const onOrgChange = () => load();
    window.addEventListener("cervise-org-change", onOrgChange);
    return () => window.removeEventListener("cervise-org-change", onOrgChange);
  }, [fixedBranchId, hasServerBranches]);

  const setBranch = React.useCallback(
    (next: Branch) => {
      if (fixedBranchId) return;
      // Memilih cabang = aksi "select" (dot), bukan tab-switch: pengguna
      // memilih satu item dari daftar.
      sfx.select();
      const previous = branch;
      setBranchState(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("cervise-branch", next.id);
        window.dispatchEvent(new CustomEvent("cervise-branch-change", { detail: next }));
      }
      // Sumber kebenaran adalah cookie server; label saja tidak cukup.
      // `router.refresh()` membuat ulang server components dengan scope baru.
      setBranchScope(next.id)
        .then(() => router.refresh())
        .catch(() => {
          setBranchState(previous);
          if (typeof window !== "undefined") {
            window.localStorage.setItem("cervise-branch", previous.id);
          }
        });
    },
    [branch, fixedBranchId, router],
  );

  // listen for external changes (e.g., from other tabs)
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (fixedBranchId) return;
      if (e.key === "cervise-branch" && e.newValue) {
        const found = branches.find((b) => b.id === e.newValue);
        if (found) setBranchState(found);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [branches, fixedBranchId]);

  const value = React.useMemo(
    () => ({ branch, setBranch, branches }),
    [branch, setBranch, branches],
  );
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
