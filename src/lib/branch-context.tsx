"use client";

import * as React from "react";

export type Branch = {
  id: string;
  label: string;
  meta: string;
};

export const BRANCHES: Branch[] = [
  { id: "all", label: "Semua cabang", meta: "Semua cabang · live" },
  { id: "pusat", label: "Cervise Pusat", meta: "Pusat · 3 teknisi" },
  { id: "cab2", label: "Cervise Cabang 2", meta: "Tangerang · 2 teknisi" },
  { id: "cab3", label: "Cervise Cabang 3", meta: "Bekasi · 2 teknisi" },
  { id: "express", label: "Cervise Express", meta: "Depok · 1 teknisi" },
  { id: "mitra", label: "Mitra Reseller", meta: "Partner · dropship" },
];

type BranchContextValue = {
  branch: Branch;
  setBranch: (b: Branch) => void;
  branches: Branch[];
};

const BranchContext = React.createContext<BranchContextValue | null>(null);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branch, setBranchState] = React.useState<Branch>(BRANCHES[0]);

  // persist in localStorage
  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("cervise-branch") : null;
    if (saved) {
      const found = BRANCHES.find((b) => b.id === saved);
      if (found) setBranchState(found);
    }
  }, []);

  const setBranch = React.useCallback((b: Branch) => {
    setBranchState(b);
    if (typeof window !== "undefined") window.localStorage.setItem("cervise-branch", b.id);
    // dispatch event for non-context consumers
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cervise-branch-change", { detail: b }));
  }, []);

  // listen for external changes (e.g., from other tabs)
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cervise-branch" && e.newValue) {
        const found = BRANCHES.find((b) => b.id === e.newValue);
        if (found) setBranchState(found);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = React.useMemo(() => ({ branch, setBranch, branches: BRANCHES }), [branch, setBranch]);
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
