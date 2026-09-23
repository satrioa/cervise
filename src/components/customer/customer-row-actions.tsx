"use client";

import { useEffect, useState } from "react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import { EllipsisIcon, PencilIcon, EyeIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { deleteCustomer, getCustomerServis, type CustomerServisRow } from "@/app/app/customer/actions";
import { CustomerDialog } from "./customer-dialog";
import { useRouter } from "next/navigation";

type Customer = {
  id: string;
  name: string;
  phone: string; // 62
  phoneDisplay: string;
  totalServis: number;
  totalSpent: number;
};

export function CustomerRowActions({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [lihatOpen, setLihatOpen] = useState(false);
  const [servis, setServis] = useState<CustomerServisRow[]>([]);
  const [loadingServis, setLoadingServis] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lihatOpen) return;
    setLoadingServis(true);
    getCustomerServis(customer.id)
      .then(setServis)
      .catch(() => setServis([]))
      .finally(() => setLoadingServis(false));
  }, [lihatOpen, customer.id]);

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await deleteCustomer(customer.id);
      setDeleteOpen(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Gagal hapus");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Menu>
        <MenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${customer.name}`} />}>
          <EllipsisIcon />
        </MenuTrigger>
        <MenuPopup align="end">
          <MenuItem onClick={() => setEditOpen(true)}>
            <PencilIcon /> Edit
          </MenuItem>
          <MenuItem onClick={() => setLihatOpen(true)}>
            <EyeIcon /> Lihat servis
          </MenuItem>
          <MenuSeparator />
          <MenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <TrashIcon /> Hapus
          </MenuItem>
        </MenuPopup>
      </Menu>

      <CustomerDialog open={editOpen} onOpenChange={setEditOpen} mode="edit" initial={{ id: customer.id, name: customer.name, phone: customer.phone }} />

      {/* Delete confirm */}
      <DialogPrimitive.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
            <DialogPrimitive.Title className="font-heading text-sm">Hapus customer?</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-xs text-muted-foreground mt-1">
              {customer.name} · {customer.phoneDisplay} — {customer.totalServis} servis, {formatCurrencyPlain(customer.totalSpent)} spent. {customer.totalServis > 0 ? "Punya servis → diblok." : ""}
            </DialogPrimitive.Description>
            {error && <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>Batal</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "Menghapus..." : "Hapus"}</Button>
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Lihat servis — Popover center modal */}
      <DialogPrimitive.Root open={lihatOpen} onOpenChange={setLihatOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="border-b px-5 py-4">
              <DialogPrimitive.Title className="font-heading text-sm">Servis — {customer.name}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-muted-foreground">{customer.phoneDisplay} · {customer.totalServis} servis · Total {formatCurrencyPlain(customer.totalSpent)}</DialogPrimitive.Description>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingServis ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Memuat servis...</div>
              ) : servis.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada servis — 0 / Rp 0 / —</div>
              ) : (
                <div className="space-y-2">
                  {servis.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-medium">{s.id} · {s.status}</div>
                        <div className="truncate text-sm">{s.problem}</div>
                        <div className="text-xs text-muted-foreground">{s.created_at}</div>
                      </div>
                      <Badge variant="secondary" size="sm" className="font-mono tabular-nums shrink-0">{formatCurrencyPlain((s.subtotal_cents / 100))}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t bg-muted/20 px-5 py-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setLihatOpen(false)}>Tutup</Button>
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}