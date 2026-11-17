"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarcodeScannerDialog } from "@/components/scan/barcode-scanner-dialog";
import { OpnameCountPanel, type CountLine } from "@/components/inventori/opname-count-panel";
import { OpnameExport } from "@/components/inventori/opname-export";
import { OpnameReviewDialog } from "@/components/inventori/opname-review-dialog";
import {
  cancelSession,
  createSession,
  getSession,
  listSessions,
  saveCount,
  type OpnameLine,
  type OpnameSession,
} from "./actions";

type Domain = "product" | "sparepart";
type Active = { session: OpnameSession; lines: CountLine[] };

function toCountLine(line: OpnameLine): CountLine {
  return {
    id: line.id,
    refId: line.ref_id,
    sku: line.sku ?? "",
    name: line.name ?? "",
    imei: line.imei,
    snapshotQty: line.snapshot_qty,
    countedQty: line.counted_qty,
    cost: line.unit_cost ?? 0,
  };
}

function SessionList({
  sessions,
  onCreate,
  onOpen,
  onCancel,
  canPost,
}: {
  sessions: OpnameSession[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  onCancel: (id: string) => void;
  canPost: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={onCreate}>
          <PlusIcon data-icon="inline-start" />
          Sesi Baru
        </Button>
      </div>
      {sessions.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Belum ada sesi opname. Buat sesi untuk mulai menghitung stok fisik.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <CardTitle className="text-sm">
                  {new Date(session.started_at).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </CardTitle>
                <Badge variant={session.status === "POSTED" ? "default" : session.status === "DRAFT" ? "secondary" : "outline"}>
                  {session.status}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
                {session.note ? <p className="line-clamp-2">{session.note}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => onOpen(session.id)}>
                    Lihat
                  </Button>
                  {canPost && session.status === "DRAFT" ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => onCancel(session.id)}>
                      Batalkan
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function OpnameClient({
  products,
  spareparts,
  canPost,
}: {
  products: OpnameSession[];
  spareparts: OpnameSession[];
  canPost: boolean;
}) {
  const [domain, setDomain] = useState<Domain>("product");
  const [sessions, setSessions] = useState({ product: products, sparepart: spareparts });
  const [newOpen, setNewOpen] = useState(false);
  const [note, setNote] = useState("");
  const [active, setActive] = useState<Active | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [p, s] = await Promise.all([listSessions("product"), listSessions("sparepart")]);
    setSessions({ product: p, sparepart: s });
  };

  const openSession = async (id: string) => {
    setBusy(true);
    try {
      const { session, lines } = await getSession(id);
      setActive({ session, lines: lines.map(toCountLine) });
      setDrawerOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuka sesi");
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const id = await createSession(domain, note);
      setNewOpen(false);
      setNote("");
      await refresh();
      await openSession(id);
      toast.success("Sesi opname dibuat");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuat sesi");
    } finally {
      setBusy(false);
    }
  };

  const setCount = async (line: CountLine, value: number) => {
    if (!active || active.session.status !== "DRAFT") return;
    setActive((prev) =>
      prev
        ? {
            ...prev,
            lines: prev.lines.map((l) => (l.id === line.id ? { ...l, countedQty: value } : l)),
          }
        : prev,
    );
    try {
      await saveCount(active.session.id, line.refId, line.imei, value);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan hitungan");
    }
  };

  const onScan = (value: string) => {
    if (!active) return;
    const term = value.trim();
    const line =
      active.lines.find((l) => l.imei && l.imei.toLowerCase() === term.toLowerCase()) ??
      active.lines.find((l) => l.sku.toLowerCase() === term.toLowerCase());
    if (!line) {
      toast.info("Barang tidak ada dalam sesi ini");
      return;
    }
    void setCount(line, line.imei ? 1 : line.snapshotQty);
    setScanOpen(false);
  };

  const cancel = async (id: string) => {
    setBusy(true);
    try {
      await cancelSession(id);
      await refresh();
      toast.success("Sesi dibatalkan");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membatalkan sesi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Tabs value={domain} onValueChange={(v) => setDomain(v as Domain)}>
        <TabsList>
          <TabsTrigger value="product">Produk</TabsTrigger>
          <TabsTrigger value="sparepart">Sparepart</TabsTrigger>
        </TabsList>
        <TabsContent value="product">
          <SessionList
            sessions={sessions.product}
            onCreate={() => setNewOpen(true)}
            onOpen={(id) => void openSession(id)}
            onCancel={(id) => void cancel(id)}
            canPost={canPost}
          />
        </TabsContent>
        <TabsContent value="sparepart">
          <SessionList
            sessions={sessions.sparepart}
            onCreate={() => setNewOpen(true)}
            onOpen={(id) => void openSession(id)}
            onCancel={(id) => void cancel(id)}
            canPost={canPost}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sesi Opname Baru</DialogTitle>
            <DialogDescription>
              Stok sistem saat ini dibekukan sebagai baseline. Domain: {domain === "product" ? "Produk" : "Sparepart"}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="opname-note">Catatan (opsional)</Label>
            <Input
              id="opname-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Hitung bulanan cabang"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
              Batal
            </Button>
            <Button type="button" loading={busy} onClick={() => void create()}>
              Buat Sesi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerPopup className="max-h-[92dvh] sm:max-w-2xl">
          <DrawerHeader>
            <DrawerTitle>Hitung Stok</DrawerTitle>
            <DrawerDescription>
              {active?.session.note || "Isi jumlah fisik lalu tinjau selisihnya."}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="flex min-h-0 flex-col">
            {active ? (
              <OpnameCountPanel
                lines={active.lines}
                readOnly={active.session.status !== "DRAFT"}
                onCount={(line, value) => void setCount(line, value)}
                onReview={() => setReviewOpen(true)}
                onScan={() => setScanOpen(true)}
              />
            ) : null}
          </DrawerPanel>
          <DrawerFooter>
            <DrawerClose render={<Button type="button" variant="outline" />}>
              Tutup
            </DrawerClose>
          </DrawerFooter>
        </DrawerPopup>
      </Drawer>

      {active ? (
        <>
          <OpnameReviewDialog
            open={reviewOpen}
            onOpenChange={setReviewOpen}
            sessionId={active.session.id}
            lines={active.lines}
            canPost={canPost && active.session.status === "DRAFT"}
            onPosted={() => void refresh()}
            exportSlot={<OpnameExport lines={active.lines} session={active.session} />}
          />
          <BarcodeScannerDialog
            open={scanOpen}
            onOpenChange={setScanOpen}
            title="Scan barcode / IMEI"
            description="Arahkan kamera ke barcode produk atau IMEI unit bekas."
            onDetected={onScan}
          />
        </>
      ) : null}
    </>
  );
}
