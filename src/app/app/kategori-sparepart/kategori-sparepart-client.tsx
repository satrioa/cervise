"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/lib/branch-context";
import { toast } from "sonner";
import { PlusIcon, PencilIcon, TrashIcon, TagIcon, XIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";

type Kategori = { id: string; branch_id: string; name: string; description?: string | null; created_at: string };

export default function KategoriSparepartPage() {
  const { branch } = useBranch();
  const [rows, setRows] = useState<Kategori[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Kategori | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    const supabase = createClient();
    // try kategori table, fallback to distinct from spareparts
    const { data, error } = await supabase.from("cervise_sparepart_categories").select("id,branch_id,name,description,created_at").eq("branch_id", branch.id).order("name");
    if (!error && data) {
      setRows(data as Kategori[]);
      return;
    }
    // fallback: distinct categories from spareparts (if table not exists)
    const { data: sp } = await supabase.from("cervise_spareparts").select("category").eq("branch_id", branch.id);
    const cats = Array.from(new Set(((sp as any[]) ?? []).map((r) => r.category).filter(Boolean)));
    setRows(cats.map((c, i) => ({ id: `cat-${i}`, branch_id: branch.id, name: c, description: null, created_at: new Date().toISOString() })));
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch.id]);

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDesc("");
    setOpen(true);
  };
  const openEdit = (r: Kategori) => {
    setEditing(r);
    setName(r.name);
    setDesc(r.description ?? "");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nama kategori wajib");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      if (editing) {
        const { error } = await supabase.from("cervise_sparepart_categories").update({ name: name.trim(), description: desc.trim() || null }).eq("id", editing.id);
        if (error) throw error;
        toast.success("Kategori diperbarui");
      } else {
        const { error } = await supabase.from("cervise_sparepart_categories").insert({ branch_id: branch.id, name: name.trim(), description: desc.trim() || null });
        if (error) {
          // if table not exists, just local add
          if (error.message.includes("does not exist") || error.code === "42P01") {
            setRows((prev) => [...prev, { id: `cat-${Date.now()}`, branch_id: branch.id, name: name.trim(), description: desc.trim() || null, created_at: new Date().toISOString() }]);
            toast.success("Kategori ditambah (lokal, tabel belum ada)");
            setOpen(false);
            return;
          }
          throw error;
        }
        toast.success("Kategori ditambah");
      }
      setOpen(false);
      fetch();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal simpan");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (r: Kategori) => {
    if (!confirm(`Hapus kategori "${r.name}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("cervise_sparepart_categories").delete().eq("id", r.id);
    if (error && !error.message.includes("does not exist")) {
      toast.error(error.message);
      return;
    }
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    toast.success("Dihapus");
  };

  return (
    <div className="min-h-svh bg-background">
      <PageHeader
        title="Kategori Sparepart"
        titleClassName="font-heading text-2xl"
        description="CRUD kategori per cabang. Dipakai di filter Inventori & form Sparepart."
        containerClassName="max-w-4xl"
        search={
          <div className="flex w-full items-center gap-2">
            <Input placeholder="Cari kategori..." value={q} onChange={(e) => setQ(e.target.value)} className="h-8" />
            {q && (
              <Button variant="ghost" size="sm" className="h-8 shrink-0" onClick={() => setQ("")}>
                <XIcon className="size-3.5" /> Clear
              </Button>
            )}
          </div>
        }
        actions={
          <Button size="sm" className="h-8 shrink-0" onClick={openCreate}>
            <PlusIcon className="size-3.5" /> Tambah Kategori
          </Button>
        }
      />

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><TagIcon className="size-4" /> Daftar Kategori</CardTitle>
            <CardDescription>{filtered.length} kategori · {branch.label}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      Belum ada kategori. Klik Tambah Kategori.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.description ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("id-ID")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(r)}>
                            <PencilIcon className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(r)}>
                            <TrashIcon className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg">
            <DialogPrimitive.Title className="font-semibold">{editing ? "Edit Kategori" : "Tambah Kategori"}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">Nama unik per cabang.</DialogPrimitive.Description>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Nama *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Baterai, LCD, Fleksibel..." />
              </div>
              <div className="space-y-1.5">
                <Label>Deskripsi (opsional)</Label>
                <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Keterangan singkat" rows={2} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                  Batal
                </Button>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? "Menyimpan..." : editing ? "Simpan" : "Tambah"}
                </Button>
              </div>
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted">
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      </div>
    </div>
  );
}
