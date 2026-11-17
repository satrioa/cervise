"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BarcodeScannerDialog } from "@/components/scan/barcode-scanner-dialog";
import { OpnameCountPanel, type CountLine } from "@/components/inventori/opname-count-panel";
import { OpnameExport } from "@/components/inventori/opname-export";
import { OpnameReviewDialog } from "@/components/inventori/opname-review-dialog";
import { saveCount, type OpnameSession } from "../actions";
import { toCountLine } from "../opname-client";

export function OpnameCountClient({
  session,
  lines,
  canPost,
}: {
  session: OpnameSession;
  lines: Parameters<typeof toCountLine>[0][];
  canPost: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<CountLine[]>(() => lines.map(toCountLine));
  const [reviewOpen, setReviewOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const readOnly = session.status !== "DRAFT";

  const setCount = async (line: CountLine, value: number) => {
    if (readOnly) return;
    setCurrent((prev) =>
      prev.map((item) => (item.id === line.id ? { ...item, countedQty: value } : item)),
    );
    try {
      await saveCount(session.id, line.refId, line.imei, value);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan hitungan");
    }
  };

  const onScan = (value: string) => {
    const term = value.trim();
    const line =
      current.find((item) => item.imei && item.imei.toLowerCase() === term.toLowerCase()) ??
      current.find((item) => item.sku.toLowerCase() === term.toLowerCase());
    if (!line) {
      toast.info("Barang tidak ada dalam sesi ini");
      return;
    }
    void setCount(line, line.imei ? 1 : line.snapshotQty);
    setScanOpen(false);
  };

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/inventori/opname">
            <ArrowLeftIcon data-icon="inline-start" />
            Kembali
          </Link>
        </Button>
        <span className="text-xs text-muted-foreground">
          {session.domain} · {session.status}
        </span>
      </div>

      <OpnameCountPanel
        lines={current}
        readOnly={readOnly}
        onCount={(line, value) => void setCount(line, value)}
        onReview={() => setReviewOpen(true)}
        onScan={() => setScanOpen(true)}
      />

      <OpnameReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        sessionId={session.id}
        lines={current}
        canPost={canPost && !readOnly}
        onPosted={() => router.refresh()}
        exportSlot={<OpnameExport lines={current} session={session} />}
      />
      <BarcodeScannerDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        title="Scan barcode / IMEI"
        description="Arahkan kamera ke barcode produk atau IMEI unit bekas."
        onDetected={onScan}
      />
    </div>
  );
}
