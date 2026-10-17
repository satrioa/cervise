"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { KONDISI_ITEMS, type KondisiAwal } from "@/lib/servis-constants";

type Props = {
  onSave: (data: KondisiAwal) => Promise<void>;
  onSkip: () => void;
};

function emptyKondisi(): KondisiAwal {
  const init: KondisiAwal = {};
  KONDISI_ITEMS.forEach((k) => (init[k] = { status: "normal", note: "" }));
  return init;
}

/**
 * Pemeriksaan kondisi awal, sebagai panel inline -- bukan modal.
 *
 * Sebelumnya ini `KondisiAwalDialog`, dan tombol simpannya tidak pernah terlihat
 * oleh pengguna. Penyebabnya bukan tombolnya hilang, tapi kontainernya salah:
 * `Popup` memakai `grid` dengan `max-h-[85vh]` + `overflow-hidden`, sementara
 * badan yang supposed bisa digulir punya `flex-1`. Di dalam `grid`, `flex-1`
 * tidak berlaku apa-apa, jadi badan tumbuh setinggi isinya. Sebelas item membuat
 * isinya melebihi tinggi maksimum, dan `overflow-hidden` memotong kaki dialog --
 * tempat kedua tombol itu berada. Jadi tombolnya ada, tapi di luar layar.
 *
 * Sekarang tidak ada modal, jadi batas tinggi itu tidak berlaku lagi dan
 * masalah yang sama tidak mungkin terulang di tempat lain. Kalau nanti versi ini
 * benar-benar butuh tinggi maksimum, polanya `flex flex-col` + anak `flex-1
 * overflow-auto`, bukan `grid` + `flex-1`.
 */
export function KondisiAwalForm({ onSave, onSkip }: Props) {
  const [data, setData] = useState<KondisiAwal>(emptyKondisi);
  const [saving, setSaving] = useState(false);

  const setStatus = (key: string, status: "normal" | "tidak_normal") => {
    setData((prev) => ({ ...prev, [key]: { ...prev[key], status } }));
  };
  const setNote = (key: string, note: string) => {
    setData((prev) => ({ ...prev, [key]: { ...prev[key], note } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-0">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Check Kondisi Awal</CardTitle>
          <CardDescription>
            Tandai bagian yang bermasalah sebelum dikerjakan. Data servis sudah tersimpan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="hidden grid-cols-[1fr_180px_1fr] gap-2 px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:grid">
            <span>Item</span>
            <span className="text-center">Kondisi</span>
            <span>Note</span>
          </div>
          <Separator className="hidden sm:block" />
          <div className="flex flex-col gap-2">
            {KONDISI_ITEMS.map((item) => {
              const st = data[item]?.status ?? "normal";
              return (
                <div
                  key={item}
                  className="grid grid-cols-1 items-center gap-2 rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5 sm:grid-cols-[1fr_180px_1fr]"
                >
                  <span className="text-sm font-medium">{item}</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      aria-pressed={st === "normal"}
                      onClick={() => setStatus(item, "normal")}
                      className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${st === "normal" ? "border-emerald-600 bg-emerald-500 text-white" : "border-border bg-background hover:bg-muted"}`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      aria-pressed={st === "tidak_normal"}
                      onClick={() => setStatus(item, "tidak_normal")}
                      className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${st === "tidak_normal" ? "border-amber-600 bg-amber-500 text-white" : "border-border bg-background hover:bg-muted"}`}
                    >
                      Tidak Normal
                    </button>
                  </div>
                  <Input
                    aria-label={`Catatan ${item}`}
                    placeholder="Catatan (opsional)"
                    value={data[item]?.note ?? ""}
                    onChange={(e) => setNote(item, e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/*
        Tombol simpan dipindah ke luar Cards, dan tetap `type="button"` --
        tidak ada elemen <form> di sekitar sini, jadi tidak ada submit tidak
        sengaja yang bergantung pada tombol paling kanan.
      */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onSkip} disabled={saving}>
          Lewati
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan Kondisi"}
        </Button>
      </div>
    </div>
  );
}
