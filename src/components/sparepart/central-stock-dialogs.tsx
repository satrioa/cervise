"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { playPageTransition } from "@/components/layout/page-transition";
import type { Branch } from "@/lib/branch-context";
import {
  approveStockRequest,
  distributeCentralStock,
  listStockRequests,
  rejectStockRequest,
  requestStock,
  type CentralItemRow,
  type StockRequestRow,
} from "@/app/app/sparepart/central-actions";

type Mode = "distribute" | "request" | "approve";

const TITLES: Record<Mode, string> = {
  distribute: "Distribusi Stok Pusat",
  request: "Request Stok",
  approve: "Approve Request Stok",
};

/** Satu dialog untuk tiga alur stok pusat: distribusi, request cabang, approve. */
export function CentralStockDialogs({
  mode,
  items,
  branches,
  currentBranchId,
  onClose,
  onDone,
}: {
  mode: Mode | null;
  items: CentralItemRow[];
  branches: Branch[];
  currentBranchId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [itemId, setItemId] = useState("");
  const [target, setTarget] = useState("");
  const [qty, setQty] = useState("1");
  const [imei, setImei] = useState("");
  const [requests, setRequests] = useState<StockRequestRow[]>([]);
  const [requestId, setRequestId] = useState("");
  const [centralId, setCentralId] = useState("");
  const [decidedQty, setDecidedQty] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== "approve") return;
    listStockRequests()
      .then((rows) => {
        const pending = rows.filter((row) => row.status === "PENDING");
        setRequests(pending);
        setRequestId(pending[0]?.id ?? "");
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Gagal memuat request"));
  }, [mode]);

  const selected = items.find((item) => item.id === itemId) ?? null;
  const targets = branches.filter((branch) => branch.id !== "all" && branch.id !== currentBranchId);
  const pending = requests.find((row) => row.id === requestId) ?? null;
  const matched = items.find((item) => item.sku === pending?.sku) ?? null;
  const approveItem = items.find((item) => item.id === centralId) ?? matched;
  const decided = decidedQty === "" ? String(pending?.decided_qty ?? pending?.qty ?? "") : decidedQty;

  const finish = async (work: () => Promise<void>, message: string) => {
    setSaving(true);
    try {
      await work();
      playPageTransition();
      toast.success(message);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memproses stok");
    } finally {
      setSaving(false);
    }
  };

  const handleStock = async () => {
    if (!selected) {
      toast.error("Pilih item dulu");
      return;
    }
    const amount = Number(qty);
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("Jumlah harus bilangan bulat lebih dari nol");
      return;
    }
    if (mode === "distribute") {
      if (!target) {
        toast.error("Pilih cabang tujuan");
        return;
      }
      if (selected.is_serialized && !imei.trim()) {
        toast.error("IMEI wajib untuk item serialized");
        return;
      }
      await finish(
        () => distributeCentralStock({
          id: selected.id,
          targetBranchId: target,
          qty: amount,
          expectedStock: selected.stock_qty,
          imei: selected.is_serialized ? imei.trim() : undefined,
        }),
        "Stok didistribusikan",
      );
      return;
    }
    await finish(() => requestStock({ sku: selected.sku, qty: amount }), "Request dikirim");
  };

  const handleApprove = async () => {
    if (!pending || !approveItem) {
      toast.error("Pilih request dan item pusat yang sesuai");
      return;
    }
    const amount = Number(decided);
    if (!Number.isInteger(amount) || amount <= 0 || amount > pending.qty) {
      toast.error("Jumlah disetujui harus antara 1 dan jumlah request");
      return;
    }
    await finish(
      () => approveStockRequest({
        requestId: pending.id,
        decidedQty: amount,
        centralItemId: approveItem.id,
        expectedStock: approveItem.stock_qty,
      }),
      "Request disetujui",
    );
  };

  const handleReject = async () => {
    if (!pending) {
      toast.error("Pilih request dulu");
      return;
    }
    await finish(() => rejectStockRequest({ requestId: pending.id, reason }), "Request ditolak");
  };

  return (
    <DialogPrimitive.Root open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg">
          <DialogPrimitive.Title className="font-semibold">
            {mode ? TITLES[mode] : ""}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-sm text-muted-foreground">
            {mode === "approve"
              ? "Setujui sebagian atau seluruh request; stok pusat berkurang saat disetujui."
              : mode === "distribute"
                ? "Stok pusat berkurang dan stok cabang tujuan bertambah."
                : "Request dikirim ke gudang pusat untuk disetujui."}
          </DialogPrimitive.Description>

          <div className="mt-4 space-y-3">
            {mode === "approve" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Request pending ({requests.length})</Label>
                  <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border p-1">
                    {requests.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-muted-foreground">Tidak ada request pending.</p>
                    ) : requests.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        aria-label={`Pilih request ${row.sku} ${row.qty} unit`}
                        onClick={() => { setRequestId(row.id); setDecidedQty(""); setReason(""); }}
                        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-xs ${row.id === requestId ? "bg-accent" : "hover:bg-muted"}`}
                      >
                        <span className="min-w-0 truncate font-mono">{row.sku}</span>
                        <span className="shrink-0 text-muted-foreground">{row.qty} unit</span>
                      </button>
                    ))}
                  </div>
                </div>
                {pending ? (
                  <p className="text-xs text-muted-foreground">
                    {branches.find((branch) => branch.id === pending.branch_id)?.label ?? pending.branch_id}
                    {pending.note ? ` · ${pending.note}` : ""}
                  </p>
                ) : null}
                <div className="space-y-1.5">
                  <Label>Item pusat</Label>
                  <select
                    value={centralId}
                    onChange={(event) => setCentralId(event.target.value)}
                    aria-label="Pilih item pusat untuk request ini"
                    className="min-h-11 w-full rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="">{matched ? `Otomatis: ${matched.sku}` : "Pilih item..."}</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.sku} — {item.name} (stok {item.stock_qty})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Jumlah disetujui *</Label>
                  <Input
                    type="number"
                    min={1}
                    max={pending?.qty}
                    inputMode="numeric"
                    aria-label="Jumlah disetujui"
                    className="min-h-11"
                    value={decided}
                    onChange={(event) => setDecidedQty(event.target.value)}
                  />
                  {approveItem ? (
                    <p className="text-[11px] text-muted-foreground">Stok pusat saat ini {approveItem.stock_qty} unit.</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label>Alasan penolakan</Label>
                  <Input
                    aria-label="Alasan penolakan"
                    className="min-h-11"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Minimal 3 karakter"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Item *</Label>
                  <select
                    value={itemId}
                    onChange={(event) => setItemId(event.target.value)}
                    aria-label="Pilih item"
                    className="min-h-11 w-full rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="">Pilih item...</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.sku} — {item.name} (stok {item.stock_qty})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Jumlah *</Label>
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    aria-label="Jumlah"
                    className="min-h-11"
                    value={qty}
                    onChange={(event) => setQty(event.target.value)}
                  />
                </div>
                {mode === "distribute" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>Cabang tujuan *</Label>
                      <select
                        value={target}
                        onChange={(event) => setTarget(event.target.value)}
                        aria-label="Pilih cabang tujuan"
                        className="min-h-11 w-full rounded-md border bg-background px-2 text-sm"
                      >
                        <option value="">Pilih cabang...</option>
                        {targets.map((branch) => (
                          <option key={branch.id} value={branch.id}>{branch.label}</option>
                        ))}
                      </select>
                    </div>
                    {selected?.is_serialized ? (
                      <div className="space-y-1.5">
                        <Label>IMEI *</Label>
                        <Input
                          inputMode="numeric"
                          maxLength={15}
                          aria-label="IMEI unit"
                          className="min-h-11 font-mono"
                          value={imei}
                          onChange={(event) => setImei(event.target.value.replace(/\D/g, "").slice(0, 15))}
                          placeholder="15 digit"
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="outline" className="min-h-11" onClick={onClose} disabled={saving}>
              Batal
            </Button>
            {mode === "approve" ? (
              <Button variant="destructive" className="min-h-11" onClick={handleReject} disabled={saving || !pending || reason.trim().length < 3}>
                Tolak
              </Button>
            ) : null}
            <Button className="min-h-11" onClick={mode === "approve" ? handleApprove : handleStock} disabled={saving}>
              {saving ? "Memproses..." : mode === "approve" ? "Approve" : mode === "distribute" ? "Distribusi" : "Kirim Request"}
            </Button>
          </div>

          <DialogPrimitive.Close className="absolute right-3 top-3 min-h-11 min-w-11 rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Tutup">
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
