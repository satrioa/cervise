"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import {
  saveTopupPackage,
  setTopupPackageActive,
} from "@/app/owner/actions";
import { playPageTransition } from "@/components/layout/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRupiah } from "@/lib/format";

export type TopupPackageRow = {
  id: string;
  code: string;
  name: string;
  message_quantity: number;
  price_idr: number;
  is_active: boolean;
  sort_order: number;
};

const EMPTY = { code: "", name: "", messageQuantity: "", priceIdr: "", sortOrder: "0" };

export function TopupPackageManager({ packages }: { packages: TopupPackageRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();

  const refresh = () => {
    playPageTransition();
    router.refresh();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await saveTopupPackage({ ...form, id: editingId ?? undefined });
      toast.success(editingId ? "Paket top-up diperbarui" : "Paket top-up dibuat");
      setForm(EMPTY);
      setEditingId(null);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan paket");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (item: TopupPackageRow) => {
    startTransition(async () => {
      try {
        await setTopupPackageActive(item.id, !item.is_active);
        toast.success("Status paket diperbarui");
        refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal mengubah status");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paket</TableHead>
              <TableHead className="text-right">Pesan</TableHead>
              <TableHead className="text-right">Harga</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada paket top-up. Owner menentukan jumlah pesan dan harga.
                </TableCell>
              </TableRow>
            ) : (
              packages.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{item.code}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {item.message_quantity.toLocaleString("id-ID")} pesan
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatRupiah(item.price_idr)}</TableCell>
                  <TableCell>
                    <Badge variant={item.is_active ? "success" : "outline"}>
                      {item.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => toggle(item)}
                    >
                      {item.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          code: item.code,
                          name: item.name,
                          messageQuantity: String(item.message_quantity),
                          priceIdr: String(item.price_idr),
                          sortOrder: String(item.sort_order),
                        });
                      }}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? "Edit paket top-up" : "Tambah paket top-up"}</CardTitle>
          <CardDescription>
            Top-up dijual per jumlah pesan, bukan saldo rupiah. Saldo dipakai lintas cabang dalam satu tenant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="topup-code">Kode</Label>
              <Input id="topup-code" required value={form.code} placeholder="wa-500" onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="topup-name">Nama</Label>
              <Input id="topup-name" required value={form.name} placeholder="500 pesan" onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="topup-qty">Jumlah pesan</Label>
              <Input id="topup-qty" required type="number" min={1} value={form.messageQuantity} placeholder="500" onChange={(e) => setForm({ ...form, messageQuantity: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="topup-price">Harga (IDR)</Label>
              <Input id="topup-price" required type="number" min={1} value={form.priceIdr} placeholder="150000" onChange={(e) => setForm({ ...form, priceIdr: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="topup-order">Urutan</Label>
              <Input id="topup-order" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" loading={saving} className="w-full" prefix={editingId ? undefined : <PlusIcon data-icon="inline-start" />}>
                {editingId ? "Simpan perubahan" : "Tambah paket"}
              </Button>
              {editingId ? (
                <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setForm(EMPTY); }}>
                  Batal
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
