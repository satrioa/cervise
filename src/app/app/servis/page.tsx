"use client";

import { useState, useMemo } from "react";
import { CheckIcon, CircleDotIcon, PackageIcon, TruckIcon, WrenchIcon, ClockIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanItem, KanbanItemHandle, KanbanOverlay } from "@/components/reui/kanban";
import { Card, CardContent } from "@/components/ui/card";
import JellyRadio from "@/components/ui/jelly-radio";

type Stage = "Masuk" | "Diagnosa" | "Menunggu Konfirmasi" | "Menunggu Sparepart" | "Dikerjakan" | "Selesai" | "Sudah Diambil";

const STAGES: { key: Stage; label: string; icon: typeof CheckIcon }[] = [
  { key: "Masuk", label: "Masuk", icon: CircleDotIcon },
  { key: "Diagnosa", label: "Diagnosa", icon: SearchIcon },
  { key: "Menunggu Konfirmasi", label: "Konfirmasi", icon: ClockIcon },
  { key: "Menunggu Sparepart", label: "Sparepart", icon: PackageIcon },
  { key: "Dikerjakan", label: "Dikerjakan", icon: WrenchIcon },
  { key: "Selesai", label: "Selesai", icon: CheckIcon },
  { key: "Sudah Diambil", label: "Diambil", icon: TruckIcon },
];

const stageIndex = (s: Stage) => STAGES.findIndex((x) => x.key === s);

const DOT_COLOR: Record<Stage, string> = {
  Masuk: "bg-zinc-400",
  Diagnosa: "bg-amber-500",
  "Menunggu Konfirmasi": "bg-orange-500",
  "Menunggu Sparepart": "bg-yellow-500",
  Dikerjakan: "bg-blue-500",
  Selesai: "bg-emerald-500",
  "Sudah Diambil": "bg-violet-500",
};

type ServisItem = {
  id: string;
  device: string;
  customer: string;
  price: number;
  teknisi: string;
  status: Stage;
  complaint: string;
};

const DUMMY: ServisItem[] = [
  { id: "SV-1001", device: "iPhone 14 Pro", complaint: "Mati total tidak bisa nyala", customer: "Rina · 0812xxxx", price: 0, teknisi: "—", status: "Masuk" },
  { id: "SV-1002", device: "Samsung A54", complaint: "LCD pecah bergaris", customer: "Agus · 0813xxxx", price: 0, teknisi: "Rudi", status: "Diagnosa" },
  { id: "SV-1003", device: "Oppo Reno 8", complaint: "Baterai drop cepat", customer: "Dewi · 0812xxxx", price: 0, teknisi: "Rudi", status: "Menunggu Konfirmasi" },
  { id: "SV-1004", device: "iPhone 11", complaint: "Ganti LCD original", customer: "Rina · 0812xxxx", price: 350000, teknisi: "Rudi", status: "Menunggu Sparepart" },
  { id: "SV-1005", device: "Samsung A54", complaint: "Ganti baterai", customer: "Agus · 0813xxxx", price: 250000, teknisi: "Sari", status: "Dikerjakan" },
  { id: "SV-1006", device: "Vivo Y20", complaint: "Bootloop logo", customer: "Bambang · 0812xxxx", price: 180000, teknisi: "Sari", status: "Dikerjakan" },
  { id: "SV-1007", device: "iPhone 11", complaint: "Selesai servis", customer: "Citra · 0812xxxx", price: 400000, teknisi: "Rudi", status: "Selesai" },
  { id: "SV-1008", device: "Xiaomi Redmi", complaint: "Ganti LCD", customer: "Doni · 0813xxxx", price: 320000, teknisi: "Rudi", status: "Selesai" },
  { id: "SV-1009", device: "Vivo Y20", complaint: "Sudah diambil pelanggan", customer: "Rina · 0812xxxx", price: 300000, teknisi: "Sari", status: "Sudah Diambil" },
  { id: "SV-1010", device: "Infinix Hot 12", complaint: "Mati tidak ada respon", customer: "Eko · 0812xxxx", price: 0, teknisi: "—", status: "Masuk" },
  { id: "SV-1011", device: "Realme 11", complaint: "Konektor cas goyang", customer: "Fajar · 0813xxxx", price: 150000, teknisi: "Rudi", status: "Dikerjakan" },
  { id: "SV-1012", device: "Samsung S22", complaint: "Overheat panas", customer: "Gita · 0812xxxx", price: 0, teknisi: "—", status: "Diagnosa" },
];

export default function ServisPage() {
  const [view, setView] = useState<"table" | "kanban">("table");
  const [filter, setFilter] = useState<string>("Semua");

  const columns = useMemo(() => {
    const init: Record<string, ServisItem[]> = {};
    STAGES.forEach((s) => (init[s.key] = []));
    DUMMY.forEach((item) => init[item.status].push(item));
    return init;
  }, []);

  const [kanbanValue, setKanbanValue] = useState<Record<string, ServisItem[]>>(columns);

  const filteredTable = useMemo(() => (filter === "Semua" ? DUMMY : DUMMY.filter((d) => d.status === filter)), [filter]);

  const displayedKanban = useMemo(() => {
    if (filter === "Semua") return kanbanValue;
    const out: Record<string, ServisItem[]> = {};
    STAGES.forEach((s) => (out[s.key] = []));
    out[filter] = kanbanValue[filter] || [];
    return out;
  }, [kanbanValue, filter]);

  const jellyItems = useMemo(
    () => [
      { value: "Semua", label: "Semua" },
      ...STAGES.map((s) => ({ value: s.key, label: s.label, icon: <s.icon className="size-3.5" /> })),
    ],
    []
  );

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="border-b border-border/60 px-10 py-6">
        <div className="mx-auto flex max-w-6xl items-end justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">Servis · Workflow 7 status</div>
            <h1 className="mt-1 font-heading text-2xl">Servis</h1>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as "table" | "kanban")}>
              <TabsList>
                <TabsTrigger value="table">Table</TabsTrigger>
                <TabsTrigger value="kanban">Kanban</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm">Tambah Servis</Button>
          </div>
        </div>
      </div>

      <main className={view === "kanban" ? "w-full max-w-none px-4 py-4" : "mx-auto max-w-6xl px-10 py-8"}>
        {view === "table" && (
          <div className="overflow-x-auto pb-3">
            <JellyRadio
              items={jellyItems}
              defaultValue="Semua"
              onChange={(v: string) => setFilter(v)}
              chipColor="#e4e4e7"
              activeColor="#18181b"
              textColor="#18181b"
              activeTextColor="#f5f5f5"
              size="md"
              gap={8}
              radius={18}
            />
          </div>
        )}

        {view === "table" ? (
          <Table variant="card" className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Checkbox aria-label="Select all" />
                </TableHead>
                <TableHead>Servis</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Teknisi</TableHead>
                <TableHead className="text-right">Harga</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTable.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox aria-label={`Select ${r.id}`} />
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-xs">{r.id}</div>
                    <div className="text-muted-foreground text-xs">{r.customer}</div>
                  </TableCell>
                  <TableCell className="font-medium max-w-[220px] truncate">{r.device}</TableCell>
                  <TableCell>
                    <StageTrack stage={r.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.teknisi}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">Rp {r.price.toLocaleString("id-ID")}</TableCell>
                </TableRow>
              ))}
              {filteredTable.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Tidak ada data untuk status {filter}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          <Kanban value={displayedKanban} onValueChange={setKanbanValue} getItemValue={(item) => item.id} className="mt-4">
            <KanbanBoard className="flex gap-2">
              {STAGES.map((stage) => (
                <KanbanColumn key={stage.key} value={stage.key} className="rounded-xl border bg-muted/20 p-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 px-1 py-2">
                    <span className={`size-2 shrink-0 rounded-full ${DOT_COLOR[stage.key]}`} aria-hidden />
                    <stage.icon className="size-3.5 text-muted-foreground" />
                    <span className="font-mono text-[11px] uppercase tracking-wider">{stage.label}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px]">{displayedKanban[stage.key]?.length ?? 0}</Badge>
                  </div>
                  <KanbanColumnContent value={stage.key} className="min-h-[320px]">
                    {(displayedKanban[stage.key] || []).map((item) => (
                      <KanbanItem key={item.id} value={item.id}>
                        <KanbanItemHandle>
                          <Card className="shadow-xs cursor-grab active:cursor-grabbing">
                            <CardContent className="p-3 space-y-1.5">
                              <div className="font-mono text-xs font-medium">{item.id}</div>
                              <div className="text-sm font-medium leading-tight line-clamp-1">{item.device}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1">{item.complaint}</div>
                              <div className="text-xs text-muted-foreground">{item.customer}</div>
                              <div className="flex items-center justify-end pt-1">
                                <Badge variant="outline" className="text-[10px]">{item.teknisi}</Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </KanbanItemHandle>
                      </KanbanItem>
                    ))}
                  </KanbanColumnContent>
                </KanbanColumn>
              ))}
            </KanbanBoard>
            <KanbanOverlay>
              {({ value }) => {
                const item = DUMMY.find((d) => d.id === value);
                if (!item) return null;
                return (
                  <Card className="w-[200px] shadow-lg rotate-2">
                    <CardContent className="p-3">
                      <div className="font-mono text-xs">{item.id}</div>
                      <div className="text-sm font-medium">{item.device}</div>
                      <div className="text-xs text-muted-foreground">{item.complaint}</div>
                    </CardContent>
                  </Card>
                );
              }}
            </KanbanOverlay>
          </Kanban>
        )}
      </main>
    </div>
  );
}

function StageTrack({ stage }: { stage: Stage }) {
  const idx = stageIndex(stage);
  return (
    <div className="flex items-center gap-1">
      {STAGES.map((s, i) => {
        const Icon = s.icon;
        const reached = i <= idx;
        const current = i === idx;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div
              className={
                "flex size-5 items-center justify-center rounded-full border text-[10px] " +
                (current
                  ? "border-primary bg-primary text-primary-foreground"
                  : reached
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-border bg-muted text-muted-foreground/60")
              }
              aria-label={s.label}
              title={s.label}
            >
              <Icon className="size-3" />
            </div>
            {i < STAGES.length - 1 ? <div className={"h-px w-2 " + (i < idx ? "bg-emerald-500/40" : "bg-border")} /> : null}
          </div>
        );
      })}
    </div>
  );
}
