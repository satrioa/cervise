"use client";

import { useState, useMemo, useEffect } from "react";
import { formatCurrencyPlain, formatNumberPlain } from "@/lib/format";
import {
  CheckIcon,
  CircleDotIcon,
  PackageIcon,
  TruckIcon,
  WrenchIcon,
  ClockIcon,
  SearchIcon,
  CalendarIcon,
  XIcon,
  TableIcon,
  LayoutGridIcon,
  BanIcon,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanItem, KanbanItemHandle, KanbanOverlay } from "@/components/reui/kanban";
import { Card, CardContent } from "@/components/ui/card";
import JellyRadio from "@/components/ui/jelly-radio";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ServisForm } from "@/components/servis/servis-form";
import { EditServisForm } from "@/components/servis/edit-servis-form";
import { ServisDetailView } from "@/components/servis/servis-detail-view";
import { ServisContextMenu } from "@/components/servis-context-menu";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { getServisDetail, type ServisDetail } from "@/app/app/servis/actions";
import { updateServisStatus, getServisSpareparts } from "@/app/app/servis/sparepart-actions";
import { useBranch } from "@/lib/branch-context";
import { toPrintData, renderJetHtml, renderDotMatrixHtml, renderThermalHtml } from "@/components/print-templates";
import { cn } from "@/lib/utils";
import { SparepartPickDialog, CancelSparepartDialog } from "@/components/servis/sparepart-dialogs";
import { PageHeader } from "@/components/layout/page-header";

type Stage = "Masuk" | "Diagnosa" | "Menunggu Konfirmasi" | "Menunggu Sparepart" | "Dikerjakan" | "Selesai" | "Sudah Diambil" | "Batal";

const STAGES: { key: Stage; label: string; icon: typeof CheckIcon }[] = [
  { key: "Masuk", label: "Masuk", icon: CircleDotIcon },
  { key: "Diagnosa", label: "Diagnosa", icon: SearchIcon },
  { key: "Menunggu Konfirmasi", label: "Konfirmasi", icon: ClockIcon },
  { key: "Menunggu Sparepart", label: "Sparepart", icon: PackageIcon },
  { key: "Dikerjakan", label: "Dikerjakan", icon: WrenchIcon },
  { key: "Selesai", label: "Selesai", icon: CheckIcon },
  { key: "Sudah Diambil", label: "Diambil", icon: TruckIcon },
  { key: "Batal", label: "Batal", icon: BanIcon },
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
  Batal: "bg-red-500",
};

type PaymentStatus = "Lunas" | "DP" | "Belum dibayar";

type ServisItem = {
  id: string;
  device: string;
  customer: string;
  price: number;
  teknisi: string;
  status: Stage;
  complaint: string;
  date: string;
  payment?: PaymentStatus;
  paidAmount?: number;
};

function getPaymentStatus(item: ServisItem): PaymentStatus {
  if (item.payment) return item.payment;
  // fallback heuristic for legacy/DUMMY without explicit payment: derive from price/paidAmount
  const paid = item.paidAmount ?? 0;
  const total = item.price ?? 0;
  if (total === 0 && paid === 0) return "Belum dibayar";
  if (paid >= total && total > 0) return "Lunas";
  if (paid > 0 && paid < total) return "DP";
  // if price >0 but no paid info → treat Dikerjakan/Selesai as DP/Lunas hint
  if (total > 0 && (item.status === "Selesai" || item.status === "Sudah Diambil")) return "Lunas";
  if (total > 0 && item.status === "Dikerjakan") return "DP";
  return paid > 0 ? "DP" : "Belum dibayar";
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, { variant: "success" | "warning" | "destructive"; label: string }> = {
    Lunas: { variant: "success", label: "Lunas" },
    DP: { variant: "warning", label: "DP" },
    "Belum dibayar": { variant: "destructive", label: "Belum dibayar" },
  };
  const cfg = map[status];
  return (
    <Badge variant={cfg.variant} size="sm" className="font-medium whitespace-nowrap">
      {cfg.label}
    </Badge>
  );
}

const DUMMY: ServisItem[] = [
  { id: "SV-1001", device: "iPhone 14 Pro", complaint: "Mati total tidak bisa nyala", customer: "Rina · 081212345601", price: 0, teknisi: "—", status: "Masuk", date: "2026-09-20", payment: "Belum dibayar" },
  { id: "SV-1002", device: "Samsung A54", complaint: "LCD pecah bergaris", customer: "Agus · 081313445602", price: 0, teknisi: "Rudi", status: "Diagnosa", date: "2026-09-18", payment: "Belum dibayar" },
  { id: "SV-1003", device: "Oppo Reno 8", complaint: "Baterai drop cepat", customer: "Dewi · 081212880103", price: 0, teknisi: "Rudi", status: "Menunggu Konfirmasi", date: "2026-09-19", payment: "Belum dibayar" },
  { id: "SV-1004", device: "iPhone 11", complaint: "Ganti LCD original", customer: "Rina · 081212345601", price: 350000, teknisi: "Rudi", status: "Menunggu Sparepart", date: "2026-09-15", payment: "DP", paidAmount: 100000 },
  { id: "SV-1005", device: "Samsung A54", complaint: "Ganti baterai", customer: "Agus · 081313445602", price: 250000, teknisi: "Sari", status: "Dikerjakan", date: "2026-09-16", payment: "DP", paidAmount: 100000 },
  { id: "SV-1006", device: "Vivo Y20", complaint: "Bootloop logo", customer: "Bambang · 081299001122", price: 180000, teknisi: "Sari", status: "Dikerjakan", date: "2026-09-17", payment: "Belum dibayar" },
  { id: "SV-1007", device: "iPhone 11", complaint: "Selesai servis", customer: "Citra · 081245667788", price: 400000, teknisi: "Rudi", status: "Selesai", date: "2026-09-12", payment: "Lunas", paidAmount: 400000 },
  { id: "SV-1008", device: "Xiaomi Redmi", complaint: "Ganti LCD", customer: "Doni · 081388990011", price: 320000, teknisi: "Rudi", status: "Selesai", date: "2026-09-10", payment: "Lunas", paidAmount: 320000 },
  { id: "SV-1009", device: "Vivo Y20", complaint: "Sudah diambil pelanggan", customer: "Rina · 081212345601", price: 300000, teknisi: "Sari", status: "Sudah Diambil", date: "2026-09-08", payment: "Lunas", paidAmount: 300000 },
  { id: "SV-1010", device: "Infinix Hot 12", complaint: "Mati tidak ada respon", customer: "Eko · 081212009900", price: 0, teknisi: "—", status: "Masuk", date: "2026-09-21", payment: "Belum dibayar" },
  { id: "SV-1011", device: "Realme 11", complaint: "Konektor cas goyang", customer: "Fajar · 081376543210", price: 150000, teknisi: "Rudi", status: "Dikerjakan", date: "2026-09-19", payment: "DP", paidAmount: 50000 },
  { id: "SV-1012", device: "Samsung S22", complaint: "Overheat panas", customer: "Gita · 081234567890", price: 0, teknisi: "—", status: "Diagnosa", date: "2026-09-20", payment: "Belum dibayar" },
  { id: "SV-1013", device: "Oppo A57", complaint: "Batal servis - customer tidak jadi", customer: "Hadi · 081299887766", price: 0, teknisi: "—", status: "Batal", date: "2026-09-19", payment: "Belum dibayar" },
];

function dummyToDetail(s: ServisItem): any {
  const [merk, ...tipeParts] = s.device.split(" ");
  const tipe = tipeParts.join(" ") || s.device;
  const [custNameRaw, custPhoneRaw] = s.customer.split("·").map((x) => x.trim());
  const custName = custNameRaw ?? s.customer;
  const custPhone = custPhoneRaw ?? "";
  return {
    id: s.id,
    merk: merk ?? "",
    tipe: tipe ?? "",
    imei1: "000000000000000",
    imei2: "",
    kerusakan: [s.complaint],
    kelengkapan: [],
    password_type: "PIN" as const,
    password_value: "1234",
    cervise_customers: { name: custName, phone: custPhone, address: "" },
    teknisi_id: s.teknisi === "—" ? "" : s.teknisi,
    teknisi: s.teknisi === "—" ? null : { full_name: s.teknisi, email: null },
    creator: null,
    created_at: s.date,
    garansi_value: 30,
    garansi_unit: "hari" as const,
    price_estimasi: null,
    device: s.device,
    status: s.status,
    price: s.price,
    kondisi_awal: {},
  };
}

type DateRange = { from?: Date; to?: Date };

export default function ServisPage() {
  const [view, setView] = useState<"table" | "kanban">("table");
  const [filter, setFilter] = useState<string>("Semua");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [paymentFilter, setPaymentFilter] = useState<string>("Semua");
  const [openServis, setOpenServis] = useState(false);
  const [servisData, setServisData] = useState<ServisItem[]>(DUMMY);
  const [selectedServis, setSelectedServis] = useState<ServisItem | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ServisItem>>({});
  const [detailData, setDetailData] = useState<ServisDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkTeknisi, setBulkTeknisi] = useState<string>("Rudi");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkInvoiceOpen, setBulkInvoiceOpen] = useState(false);
  const [bulkPrintOpen, setBulkPrintOpen] = useState(false);
  const [bulkPrintType, setBulkPrintType] = useState<"Dot Matrix" | "Jet" | "Thermal">("Thermal");
  const [sparepartTarget, setSparepartTarget] = useState<ServisItem | null>(null);
  const [sparepartOpen, setSparepartOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ServisItem | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pendingBatal, setPendingBatal] = useState<ServisItem | null>(null);
  const { branch } = useBranch();

  const columns = useMemo(() => {
    const init: Record<string, ServisItem[]> = {};
    STAGES.forEach((s) => (init[s.key] = []));
    DUMMY.forEach((item) => init[item.status].push(item));
    return init;
  }, []);

  const [kanbanValue, setKanbanValue] = useState<Record<string, ServisItem[]>>(columns);

  const matchesSearch = (item: ServisItem) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const hay = `${item.id} ${item.customer}`.toLowerCase();
    return hay.includes(q);
  };
  const matchesDate = (item: ServisItem) => {
    if (!dateRange.from && !dateRange.to) return true;
    const d = new Date(item.date);
    d.setHours(0, 0, 0, 0);
    if (dateRange.from) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      if (d < from) return false;
    }
    if (dateRange.to) {
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      if (d > to) return false;
    }
    return true;
  };
  const matchesPayment = (item: ServisItem) => {
    if (paymentFilter === "Semua") return true;
    return getPaymentStatus(item) === paymentFilter;
  };
  const matchesSearchAndDate = (item: ServisItem) => matchesSearch(item) && matchesDate(item) && matchesPayment(item);

  const filteredByAll = useMemo(() => servisData.filter(matchesSearchAndDate), [servisData, search, dateRange, paymentFilter]);
  const filteredTable = useMemo(() => (filter === "Semua" ? filteredByAll : filteredByAll.filter((d) => d.status === filter)), [filteredByAll, filter]);

  const filteredKanbanBase = useMemo(() => {
    const out: Record<string, ServisItem[]> = {};
    STAGES.forEach((s) => (out[s.key] = []));
    for (const [key, items] of Object.entries(kanbanValue)) {
      out[key] = items.filter(matchesDate);
    }
    return out;
  }, [kanbanValue, dateRange]);

  const displayedKanban = useMemo(() => {
    if (filter === "Semua") return filteredKanbanBase;
    const out: Record<string, ServisItem[]> = {};
    STAGES.forEach((s) => (out[s.key] = []));
    out[filter] = filteredKanbanBase[filter] || [];
    return out;
  }, [filteredKanbanBase, filter]);

  const hasActiveFilters = search.trim().length > 0 || !!dateRange.from || !!dateRange.to || paymentFilter !== "Semua";
  const clearFilters = () => { setSearch(""); setDateRange({}); setPaymentFilter("Semua"); };

  const dateLabel = (() => {
    if (dateRange.from && dateRange.to) {
      if (dateRange.from.getMonth() === dateRange.to.getMonth() && dateRange.from.getFullYear() === dateRange.to.getFullYear()) {
        return `${format(dateRange.from, "d", { locale: localeId })}–${format(dateRange.to, "d MMM yyyy", { locale: localeId })}`;
      }
      return `${format(dateRange.from, "d MMM", { locale: localeId })} – ${format(dateRange.to, "d MMM yyyy", { locale: localeId })}`;
    }
    if (dateRange.from) return format(dateRange.from, "d MMM yyyy", { locale: localeId });
    if (dateRange.to) return format(dateRange.to, "d MMM yyyy", { locale: localeId });
    return "Rentang tanggal";
  })();

  const jellyItems = useMemo(() => [{ value: "Semua", label: "Semua" }, ...STAGES.map((s) => ({ value: s.key, label: s.label, icon: <s.icon className="size-3.5" /> }))], []);

  const handleViewDetails = (s: ServisItem) => { setSelectedServis(s); setViewOpen(true); };
  const applyLocalStatus = (s: ServisItem, next: Stage) => {
    setServisData((prev) => prev.map((it) => (it.id === s.id ? { ...it, status: next } : it)));
    setKanbanValue((prev) => {
      const nextVal: Record<string, ServisItem[]> = {};
      STAGES.forEach((st) => (nextVal[st.key] = []));
      let moved: ServisItem | null = null;
      for (const key of Object.keys(prev)) {
        for (const it of prev[key]) {
          if (it.id === s.id) moved = { ...it, status: next };
          else nextVal[key].push(it);
        }
      }
      if (moved) nextVal[next].push(moved);
      if (!moved) {
        const found = servisData.find((it) => it.id === s.id);
        if (found) nextVal[next].push({ ...found, status: next });
      }
      return nextVal;
    });
  };
  const handleStatusChange = async (s: ServisItem, next: Stage) => {
    // Dikerjakan -> popover sparepart (boleh kosong, Lewati)
    if (next === "Dikerjakan") {
      setSparepartTarget(s);
      setSparepartOpen(true);
      return;
    }
    // Batal setelah Dikerjakan/Selesai -> tanya kembalikan stok atau tetap terpakai
    if (next === "Batal" && (s.status === "Dikerjakan" || s.status === "Selesai")) {
      // cek apakah ada sparepart terpakai via server; jika tidak ada, langsung Batal
      try {
        const rows = await getServisSpareparts(s.id);
        if (rows.length > 0) {
          setCancelTarget(s);
          setPendingBatal(s);
          setCancelOpen(true);
          return;
        }
      } catch {}
      // no parts -> fall through to direct cancel
    }
    // normal path: try server, fallback local
    try {
      await updateServisStatus(s.id, next);
    } catch {}
    applyLocalStatus(s, next);
  };
  const handleEdit = (s: ServisItem) => { setSelectedServis(s); setEditForm({ device: s.device, customer: s.customer, complaint: s.complaint, price: s.price, teknisi: s.teknisi }); setEditOpen(true); };
  const handleSaveEdit = () => {
    if (!selectedServis) return;
    const updated = { ...selectedServis, ...editForm } as ServisItem;
    setServisData((prev) => prev.map((it) => (it.id === selectedServis.id ? updated : it)));
    setKanbanValue((prev) => {
      const nextVal: Record<string, ServisItem[]> = {};
      for (const k of Object.keys(prev)) nextVal[k] = prev[k].map((it) => (it.id === selectedServis.id ? updated : it));
      return nextVal;
    });
    setEditOpen(false);
  };
  const handleDelete = (s: ServisItem) => { setSelectedServis(s); setDeleteOpen(true); };
  const confirmDelete = () => {
    if (!selectedServis) return;
    setServisData((prev) => prev.filter((it) => it.id !== selectedServis.id));
    setKanbanValue((prev) => {
      const nextVal: Record<string, ServisItem[]> = {};
      for (const k of Object.keys(prev)) nextVal[k] = prev[k].filter((it) => it.id !== selectedServis.id);
      return nextVal;
    });
    setDeleteOpen(false);
  };
  const handlePrint = async (s: ServisItem, type: "Dot Matrix" | "Jet" | "Thermal") => {
    let detail: any = null;
    try {
      detail = await getServisDetail(s.id);
    } catch {}
    const data = toPrintData(s, branch, detail);
    const html = type === "Jet" ? renderJetHtml(data) : type === "Dot Matrix" ? renderDotMatrixHtml(data) : renderThermalHtml(data);
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const handleInvoice = (s: ServisItem) => {
    if (s.price === 0) {
      alert("Harga belum diisi, tidak bisa kirim invoice");
      return;
    }
    const phoneRaw = s.customer.split("·")[1]?.trim().replace(/\D/g, "") || "";
    const phone = phoneRaw.startsWith("0") ? "62" + phoneRaw.slice(1) : phoneRaw;
    if (!phone) {
      alert("Nomor HP tidak valid");
      return;
    }
    const msg = `Halo, invoice servis *${s.id}* Cervise\nDevice: ${s.device}\nNominal: ${formatCurrencyPlain(s.price)}\nStatus: ${s.status}\nTeknisi: ${s.teknisi}\nTerima kasih — Garansi 3 bulan`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // Bulk derived
  const selectedCount = selectedIds.size;
  const visibleIds = filteredTable.map((r) => r.id);
  const isAllSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const isIndeterminate = selectedCount > 0 && selectedCount < visibleIds.length;
  const selectedData = servisData.filter((s) => selectedIds.has(s.id));
  const distinctStatuses = new Set(selectedData.map((s) => s.status));
  const canBulkStatus = selectedData.length > 0 && distinctStatuses.size === 1;
  const currentBulkStatus = canBulkStatus ? selectedData[0].status : null;

  const toggleOne = (id: string, checked?: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const shouldAdd = typeof checked === "boolean" ? checked : !next.has(id);
      if (shouldAdd) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const toggleAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(visibleIds));
    else setSelectedIds(new Set());
  };

  // clear selection when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const _filterKey = `${filter}-${search}-${dateRange.from?.toISOString()}-${dateRange.to?.toISOString()}-${paymentFilter}`;
  // useEffect to clear on filter change
  // we need to import useEffect, but already used; add effect below

  const handleBulkStatus = async (next: Stage) => {
    if (!canBulkStatus) return;
    // Intercept bulk ke Dikerjakan: hanya Lewati tanpa sparepart (tidak bisa pilih per-servis)
    if (next === "Dikerjakan") {
      const ids = new Set(selectedIds);
      for (const id of ids) {
        try { await updateServisStatus(id, next); } catch {}
      }
      setServisData((prev) => prev.map((it) => (ids.has(it.id) ? { ...it, status: next } : it)));
      setKanbanValue((prev) => {
        const nextVal: Record<string, ServisItem[]> = {};
        STAGES.forEach((st) => (nextVal[st.key] = []));
        for (const key of Object.keys(prev)) {
          for (const it of prev[key]) {
            if (ids.has(it.id)) {
              if (it.status !== next) nextVal[next].push({ ...it, status: next });
              else nextVal[key].push(it);
            } else nextVal[key].push(it);
          }
        }
        return nextVal;
      });
      setSelectedIds(new Set());
      setBulkStatusOpen(false);
      return;
    }
    // Bulk Batal setelah Dikerjakan/Selesai -> simplify: keep_consumed (tidak kembalikan) agar tidak dialog per-item
    if (next === "Batal") {
      const hasInRepair = selectedData.some((s) => s.status === "Dikerjakan" || s.status === "Selesai");
      if (hasInRepair) {
        // cek ada sparepart? jika ada, perlu konfirmasi per servis -> batalkan bulk, suruh satu-per-satu
        let hasParts = false;
        for (const s of selectedData) {
          try {
            const rows = await getServisSpareparts(s.id);
            if (rows.length > 0) { hasParts = true; break; }
          } catch {}
        }
        if (hasParts) {
          alert("Bulk Batal dibatalkan: ada servis yang sudah pakai sparepart. Batalkan satu per satu agar bisa pilih Kembalikan/Tetap terpakai.");
          return;
        }
      }
    }
    const ids = new Set(selectedIds);
    for (const id of ids) {
      try { await updateServisStatus(id, next); } catch {}
    }
    setServisData((prev) => prev.map((it) => (ids.has(it.id) ? { ...it, status: next } : it)));
    setKanbanValue((prev) => {
      const nextVal: Record<string, ServisItem[]> = {};
      STAGES.forEach((st) => (nextVal[st.key] = []));
      for (const key of Object.keys(prev)) {
        for (const it of prev[key]) {
          if (ids.has(it.id)) {
            if (it.status !== next) nextVal[next].push({ ...it, status: next });
            else nextVal[key].push(it);
          } else {
            nextVal[key].push(it);
          }
        }
      }
      return nextVal;
    });
    setSelectedIds(new Set());
    setBulkStatusOpen(false);
  };

  const handleBulkAssign = () => {
    const ids = new Set(selectedIds);
    setServisData((prev) => prev.map((it) => (ids.has(it.id) ? { ...it, teknisi: bulkTeknisi } : it)));
    setKanbanValue((prev) => {
      const nextVal: Record<string, ServisItem[]> = {};
      for (const k of Object.keys(prev)) nextVal[k] = prev[k].map((it) => (ids.has(it.id) ? { ...it, teknisi: bulkTeknisi } : it));
      return nextVal;
    });
    setBulkAssignOpen(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    const ids = new Set(selectedIds);
    setServisData((prev) => prev.filter((it) => !ids.has(it.id)));
    setKanbanValue((prev) => {
      const nextVal: Record<string, ServisItem[]> = {};
      for (const k of Object.keys(prev)) nextVal[k] = prev[k].filter((it) => !ids.has(it.id));
      return nextVal;
    });
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  const handleBulkPrint = async (type: "Dot Matrix" | "Jet" | "Thermal") => {
    const data = selectedData;
    if (data.length === 0) return;
    const printDatas = await Promise.all(
      data.map(async (s) => {
        let detail: any = null;
        try {
          detail = await getServisDetail(s.id);
        } catch {}
        return toPrintData(s, branch, detail);
      })
    );
    const htmlPages = printDatas
      .map((d) => {
        const html = type === "Jet" ? renderJetHtml(d) : type === "Dot Matrix" ? renderDotMatrixHtml(d) : renderThermalHtml(d);
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const bodyContent = bodyMatch ? bodyMatch[1].replace(/<script>[\s\S]*?<\/script>/, "") : html;
        return `<div class="bulk-page" style="page-break-after: always;">${bodyContent}</div>`;
      })
      .join("");
    const firstHtml = type === "Jet" ? renderJetHtml(printDatas[0]) : type === "Dot Matrix" ? renderDotMatrixHtml(printDatas[0]) : renderThermalHtml(printDatas[0]);
    const styleMatch = firstHtml.match(/<style>([\s\S]*?)<\/style>/i);
    const styles = styleMatch ? styleMatch[1] : "";
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Print Bulk ${type} — ${data.length} servis</title><style>${styles} @media print{.bulk-page{page-break-after: always;} .bulk-page:last-child{page-break-after: auto;}}</style></head><body>${htmlPages}<script>window.print();</script></body></html>`);
    w.document.close();
    setBulkPrintOpen(false);
  };

  const handleBulkInvoice = () => {
    const data = selectedData.filter((s) => s.price > 0);
    if (data.length === 0) {
      alert("Tidak ada servis dengan harga untuk dikirim invoice");
      return;
    }
    const groups = new Map<string, ServisItem[]>();
    for (const s of data) {
      const phoneRaw = s.customer.split("·")[1]?.trim().replace(/\D/g, "") || "";
      const phone = phoneRaw.startsWith("0") ? "62" + phoneRaw.slice(1) : phoneRaw;
      if (!phone) continue;
      if (!groups.has(phone)) groups.set(phone, []);
      groups.get(phone)!.push(s);
    }
    for (const [phone, items] of groups) {
      const msg = `Halo, invoice servis Cervise:\n` + items.map((s) => `• ${s.id} ${s.device} ${formatCurrencyPlain(s.price)} (${s.status})`).join("\n") + `\nTerima kasih — Garansi 3 bulan`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    }
    setBulkInvoiceOpen(false);
  };

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filter, search, dateRange, paymentFilter]);

  useEffect(() => {
    const shouldFetch = (viewOpen || editOpen) && selectedServis;
    if (!shouldFetch) {
      if (!viewOpen && !editOpen) {
        setDetailData(null);
        setDetailLoading(false);
      }
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    getServisDetail(selectedServis!.id)
      .then((d) => {
        if (!cancelled) setDetailData(d);
      })
      .catch(() => {
        if (!cancelled) setDetailData(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewOpen, editOpen, selectedServis]);

  return (
    <div className="bg-background text-foreground">
      <PageHeader
        eyebrow="Servis · Workflow 7 status"
        title="Servis"
        titleClassName="font-heading text-2xl"
        actions={
          <Button size="filter" className="shrink-0" onClick={() => setOpenServis(true)}>Tambah Servis</Button>
        }
        toolbar={
          <>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
              <div className="relative w-full sm:w-[240px] lg:w-[260px]">
                <InputGroup className="h-8 bg-background">
                  <InputGroupAddon align="inline-start"><SearchIcon className="size-3.5 opacity-60" /></InputGroupAddon>
                  <InputGroupInput placeholder="Cari ID, nama, HP…" value={search} onChange={(e) => setSearch(e.target.value)} className="text-sm" aria-label="Cari servis" />
                  {search && (<InputGroupAddon align="inline-end"><button type="button" onClick={() => setSearch("")} className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors" aria-label="Hapus pencarian"><XIcon className="size-3.5" /></button></InputGroupAddon>)}
                </InputGroup>
              </div>
              <Popover>
                <PopoverTrigger render={<Button variant="outline" size="filter" className={cn("w-full sm:w-auto justify-start gap-2 font-normal text-sm shrink-0", !dateRange.from && !dateRange.to && "text-muted-foreground")} />}>
                  <CalendarIcon className="size-4 opacity-70" /><span className="truncate">{dateLabel}</span>
                  {(dateRange.from || dateRange.to) && (<span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setDateRange({}); }} className="ml-1 rounded p-0.5 hover:bg-foreground/10 -mr-1" aria-label="Hapus rentang tanggal"><XIcon className="size-3.5" /></span>)}
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0">
                  <Calendar mode="range" selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined} onSelect={(range) => { if (!range) setDateRange({}); else setDateRange({ from: range?.from, to: range?.to }); }} numberOfMonths={2} />
                  <div className="flex items-center justify-between border-t p-2"><span className="text-xs text-muted-foreground px-2">{dateRange.from || dateRange.to ? `${filteredByAll.length} hasil` : "Pilih rentang tanggal"}</span><Button variant="ghost" size="xs" onClick={() => setDateRange({})}>Reset</Button></div>
                </PopoverContent>
              </Popover>
              <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v ?? "Semua")}>
                <SelectTrigger size="sm" className="w-full sm:w-[160px] bg-background">
                  <SelectValue placeholder="Pembayaran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Semua">Semua pembayaran</SelectItem>
                  <SelectItem value="Lunas">Lunas</SelectItem>
                  <SelectItem value="DP">DP</SelectItem>
                  <SelectItem value="Belum dibayar">Belum dibayar</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 sm:ml-1 w-full sm:w-auto">
                <Tabs value={view} onValueChange={(v) => setView(v as "table" | "kanban")} className="flex-1 sm:flex-none">
                  <TabsList className="w-full sm:w-auto"><TabsTrigger value="table" aria-label="Table view" className="flex-1 sm:flex-none px-2.5"><TableIcon className="size-4" /></TabsTrigger><TabsTrigger value="kanban" aria-label="Kanban view" className="flex-1 sm:flex-none px-2.5"><LayoutGridIcon className="size-4" /></TabsTrigger></TabsList>
                </Tabs>
              </div>
            </div>
            {hasActiveFilters && (<div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">{filteredByAll.length} servis{search && <> untuk &ldquo;{search}&rdquo;</>}{(dateRange.from || dateRange.to) && <> · {dateLabel}</>}{paymentFilter !== "Semua" && <> · {paymentFilter}</>}</span><button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-muted transition-colors"><XIcon className="size-3" /> Hapus filter</button></div>)}
          </>
        }
      />

      <main className={view === "kanban" ? "w-full max-w-none px-4 py-4" : "mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 py-6 lg:py-8"}>
        {view === "table" && (
          <div className="relative -mx-1">
            <div className="overflow-x-auto scrollbar-none pb-3 px-1 mx-auto w-fit max-w-full [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)]">
              <JellyRadio items={jellyItems} defaultValue="Semua" onChange={(v: string) => setFilter(v)} chipColor="#e4e4e7" activeColor="#18181b" textColor="#18181b" activeTextColor="#f5f5f5" size="md" gap={8} radius={18} />
            </div>
          </div>
        )}
        {view === "table" ? (
          <Table variant="card" className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Checkbox
                    aria-label="Select all"
                    checked={isAllSelected}
                    indeterminate={isIndeterminate}
                    onCheckedChange={(v) => toggleAll(!!v)}
                  />
                </TableHead>
                <TableHead>Servis</TableHead><TableHead>Device</TableHead><TableHead>Status</TableHead><TableHead>Teknisi</TableHead><TableHead>Pembayaran</TableHead><TableHead className="text-right">Harga</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredTable.map((r) => (
                <ServisContextMenu key={r.id} servis={r} onViewDetails={handleViewDetails} onStatusChange={handleStatusChange} onEdit={handleEdit} onPrint={handlePrint} onInvoice={handleInvoice} onDelete={handleDelete}>
                  <TableRow className="cursor-context-menu hover:bg-muted/40" data-state={selectedIds.has(r.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Select ${r.id}`}
                        checked={selectedIds.has(r.id)}
                        onCheckedChange={(v) => toggleOne(r.id, !!v)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell><div className="font-mono text-xs">{r.id}</div><div className="text-muted-foreground text-xs">{r.customer}</div><div className="text-muted-foreground text-[11px]">{format(new Date(r.date), "d MMM yyyy", { locale: localeId })}</div></TableCell>
                    <TableCell className="font-medium max-w-[220px] truncate">{r.device}</TableCell>
                    <TableCell><StageTrack stage={r.status} /></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.teknisi}</TableCell>
                    <TableCell><PaymentBadge status={getPaymentStatus(r)} /></TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatCurrencyPlain(r.price)}</TableCell>
                  </TableRow>
                </ServisContextMenu>
              ))}
              {filteredTable.length === 0 && (<TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Tidak ada data</TableCell></TableRow>)}
            </TableBody>
          </Table>
        ) : (
          <Kanban
            value={displayedKanban}
            onValueChange={(next) => {
              // intercept drag to Dikerjakan / Batal
              const prev = displayedKanban;
              let moved: { item: ServisItem; from: Stage; to: Stage } | null = null;
              for (const st of STAGES) {
                const prevIds = new Set((prev[st.key] ?? []).map((x) => x.id));
                const nextIds = new Set((next[st.key] ?? []).map((x) => x.id));
                for (const id of nextIds) {
                  if (!prevIds.has(id)) {
                    // find from
                    for (const s2 of STAGES) {
                      if ((prev[s2.key] ?? []).some((x) => x.id === id)) {
                        const it = (next[st.key] ?? []).find((x) => x.id === id) ?? (prev[s2.key] ?? []).find((x) => x.id === id);
                        if (it) moved = { item: it as ServisItem, from: s2.key as Stage, to: st.key as Stage };
                        break;
                      }
                    }
                  }
                }
              }
              if (moved && moved.to === "Dikerjakan") {
                setSparepartTarget(moved.item);
                setSparepartOpen(true);
                return;
              }
              if (moved && moved.to === "Batal" && (moved.from === "Dikerjakan" || moved.from === "Selesai")) {
                getServisSpareparts(moved.item.id).then((rows) => {
                  if (rows.length > 0) {
                    setCancelTarget(moved.item);
                    setPendingBatal(moved.item);
                    setCancelOpen(true);
                  } else {
                    updateServisStatus(moved.item.id, "Batal").catch(()=>{});
                    applyLocalStatus(moved.item, "Batal");
                    setKanbanValue(next);
                  }
                });
                return;
              }
              // normal move
              if (moved) {
                updateServisStatus(moved.item.id, moved.to).catch(()=>{});
                applyLocalStatus(moved.item, moved.to);
              }
              setKanbanValue(next);
            }}
            getItemValue={(item) => item.id}
            className="mt-4"
          >
            <KanbanBoard className="flex gap-2">
              {STAGES.map((stage) => (
                <KanbanColumn key={stage.key} value={stage.key} className="rounded-xl border bg-muted/20 p-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 px-1 py-2"><span className={`size-2 shrink-0 rounded-full ${DOT_COLOR[stage.key]}`} aria-hidden /><stage.icon className="size-3.5 text-muted-foreground" /><span className="font-mono text-[11px] uppercase tracking-wider">{stage.label}</span><Badge variant="secondary" className="ml-auto text-[10px]">{displayedKanban[stage.key]?.length ?? 0}</Badge></div>
                  <KanbanColumnContent value={stage.key} className="min-h-[320px]">
                    {(displayedKanban[stage.key] || []).map((item) => {
                      const isSearchMatch = search.trim() ? `${item.id} ${item.customer}`.toLowerCase().includes(search.trim().toLowerCase()) : true;
                      const disabled = !isSearchMatch;
                      return (
                        <ServisContextMenu key={item.id} servis={item} onViewDetails={handleViewDetails} onStatusChange={handleStatusChange} onEdit={handleEdit} onPrint={handlePrint} onInvoice={handleInvoice} onDelete={handleDelete}>
                          <KanbanItem value={item.id} disabled={disabled}>
                            <KanbanItemHandle>
                              <Card className={cn("shadow-xs", disabled ? "opacity-40 grayscale" : "cursor-grab active:cursor-grabbing")}>
                                <CardContent className="p-3 space-y-1.5"><div className="font-mono text-xs font-medium">{item.id}</div><div className="text-sm font-medium leading-tight line-clamp-1">{item.device}</div><div className="text-xs text-muted-foreground line-clamp-1">{item.complaint}</div><div className="text-xs text-muted-foreground">{item.customer}</div><div className="flex items-center justify-between gap-2 pt-0.5"><span className="text-[11px] text-muted-foreground">{format(new Date(item.date), "d MMM yyyy", { locale: localeId })}</span><div className="flex items-center gap-1 shrink-0"><PaymentBadge status={getPaymentStatus(item)} /><Badge variant="outline" className="text-[10px] shrink-0">{item.teknisi}</Badge></div></div></CardContent>
                              </Card>
                            </KanbanItemHandle>
                          </KanbanItem>
                        </ServisContextMenu>
                      );
                    })}
                  </KanbanColumnContent>
                </KanbanColumn>
              ))}
            </KanbanBoard>
            <KanbanOverlay>{({ value }) => { const item = DUMMY.find((d) => d.id === value); if (!item) return null; return (<Card className="w-[200px] shadow-lg rotate-2"><CardContent className="p-3"><div className="font-mono text-xs">{item.id}</div><div className="text-sm font-medium">{item.device}</div><div className="text-xs text-muted-foreground">{item.complaint}</div></CardContent></Card>); }}</KanbanOverlay>
          </Kanban>
        )}
      </main>

      {/* Bulk drawer dock - width fit content (menyesuaikan isi) */}
      {view === "table" && selectedCount > 0 && (
        <div className="fixed bottom-[72px] lg:bottom-6 left-1/2 -translate-x-1/2 z-40 flex w-fit max-w-[calc(100vw-16px)] items-center gap-2 rounded-2xl border bg-background/95 backdrop-blur-xl px-3 py-2.5 shadow-2xl shadow-black/15 drop-shadow-[0_12px_32px_rgba(0,0,0,0.18)] supports-[backdrop-filter]:backdrop-blur-xl animate-in slide-in-from-bottom-2 fade-in-0">
          {/* handle pill */}
          <div className="absolute -top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-foreground/10 hidden lg:block" aria-hidden />
          <span className="text-sm font-medium whitespace-nowrap px-1">{selectedCount} dipilih</span>
          <span className="h-4 w-px bg-border/60 hidden sm:block" aria-hidden />
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1">
            <Button size="sm" variant="outline" disabled={!canBulkStatus} onClick={() => setBulkStatusOpen(true)} className="shrink-0 shadow-sm" title={!canBulkStatus ? `${distinctStatuses.size} status berbeda — pilih status sama` : `Ubah ${currentBulkStatus}`}>
              <span className="hidden sm:inline">Ubah status {canBulkStatus && currentBulkStatus ? `(${currentBulkStatus})` : ""}</span>
              <span className="sm:hidden">Status</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkAssignOpen(true)} className="shrink-0 shadow-sm">
              <span className="hidden sm:inline">Assign Teknisi</span>
              <span className="sm:hidden">Assign</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkInvoiceOpen(true)} className="shrink-0 shadow-sm gap-1.5">
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 text-[#25D366] shrink-0" aria-hidden="true"><path d="M19.05 4.94A9.91 9.91 0 0 0 12 2C6.48 2 2 6.48 2 12a9.91 9.91 0 0 0 1.32 4.98L2 22l5.15-1.32A9.91 9.91 0 0 0 12 22c5.52 0 10-4.48 10-10a9.91 9.91 0 0 0-2.95-7.06ZM12 20a8 8 0 0 1-4.08-1.11l-.29-.17-3.06.79.79-3.06-.17-.29A8 8 0 0 1 12 4a8 8 0 0 1 8 8 8 8 0 0 1-8 8Zm4.37-5.92c-.23-.11-1.35-.67-1.56-.74-.21-.08-.36-.11-.51.11-.15.23-.59.74-.72.89-.13.15-.26.17-.48.06-.23-.11-.97-.36-1.85-1.14-.68-.61-1.14-1.36-1.27-1.59-.13-.23-.01-.35.1-.46.1-.1.23-.26.34-.39.11-.13.15-.23.23-.38.08-.15.04-.28-.02-.39-.06-.11-.51-1.23-.7-1.68-.18-.44-.37-.38-.51-.39l-.43-.01c-.15 0-.39.06-.59.28-.2.23-.77.75-.77 1.83s.79 2.12.9 2.27c.11.15 1.55 2.37 3.76 3.32.53.23.94.36 1.26.47.53.17 1.01.14 1.39.09.42-.06 1.35-.55 1.54-1.09.19-.53.19-.99.13-1.09-.06-.1-.21-.15-.44-.26Z" /></svg>
              <span className="hidden sm:inline">Kirim Invoice WA</span>
              <span className="sm:hidden">Invoice</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkPrintOpen(true)} className="shrink-0 shadow-sm">Print</Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => setBulkDeleteOpen(true)}>Hapus</Button>
          </div>
          <Button size="icon-sm" variant="ghost" className="ml-1 shrink-0 rounded-full" onClick={() => setSelectedIds(new Set())} aria-label="Clear selection">
            <XIcon className="size-4" />
          </Button>
        </div>
      )}

      {/* Modal form servis - center modal dengan blur background */}
      <DialogPrimitive.Root open={openServis} onOpenChange={setOpenServis}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md supports-backdrop-filter:backdrop-blur-md data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[95vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-background shadow-xl data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="shrink-0 border-b px-6 py-4">
              <DialogPrimitive.Title className="font-heading text-lg font-semibold">Tambah Servis</DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground">Isi data servis baru — status awal Masuk</DialogPrimitive.Description>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div className="px-4 sm:px-6 py-4">
                <ServisForm onSuccess={() => setOpenServis(false)} onCancel={() => setOpenServis(false)} />
              </div>
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* View Details modal - rich detail sesuai form input + siapa yang input - fixed height */}
      <DialogPrimitive.Root open={viewOpen} onOpenChange={setViewOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex h-[85vh] w-[95vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-background shadow-xl">
            <div className="shrink-0 border-b px-6 py-4 flex items-start justify-between gap-3">
              <div>
                <DialogPrimitive.Title className="font-heading text-lg font-semibold">Detail Servis</DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><XIcon className="size-4" /></DialogPrimitive.Close>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden p-4 sm:p-6 flex flex-col">
              {detailLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Memuat detail...</div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <ServisDetailView data={detailData} dummy={selectedServis ?? undefined} />
                </div>
              )}
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Edit modal - full form reuse, lock siapa yang input, kondisi readonly */}
      <DialogPrimitive.Root open={editOpen} onOpenChange={setEditOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[95vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-background shadow-xl">
            <div className="shrink-0 border-b px-6 py-4">
              <DialogPrimitive.Title className="font-heading text-lg font-semibold">Edit Servis {selectedServis?.id}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground">Form lengkap sama seperti create — siapa yang input terkunci, kondisi awal readonly.</DialogPrimitive.Description>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div className="px-4 sm:px-6 py-4">
                {detailLoading ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">Memuat data...</div>
                ) : detailData ? (
                  <EditServisForm servisId={detailData.id} initial={detailData as ServisDetail} onSuccess={() => { setEditOpen(false); // refresh detail & list
                    if (detailData) {
                      const merk = (detailData as any).merk ?? "";
                      const tipe = (detailData as any).tipe ?? "";
                      const device = `${merk} ${tipe}`.trim() || detailData.device;
                      setServisData((prev) => prev.map((it) => (it.id === detailData.id ? { ...it, device, teknisi: (detailData as any).teknisi?.full_name ?? it.teknisi } : it)));
                    }
                  }} onCancel={() => setEditOpen(false)} />
                ) : selectedServis ? (
                  <EditServisForm
                    isDummy
                    servisId={selectedServis.id}
                    initial={dummyToDetail(selectedServis)}
                    onSuccess={(updated: any) => {
                      if (!updated) { setEditOpen(false); return; }
                      const device = `${updated.merk} ${updated.tipe}`.trim() || selectedServis.device;
                      const customer = `${updated.customer_name} · ${updated.customer_phone}`;
                      const complaint = updated.kerusakan.join(", ");
                      const teknisi = updated.teknisi_id || "—";
                      const updatedItem = { ...selectedServis, device, customer, complaint, teknisi } as ServisItem;
                      setServisData((prev) => prev.map((it) => (it.id === selectedServis.id ? updatedItem : it)));
                      setKanbanValue((prev) => {
                        const nextVal: Record<string, ServisItem[]> = {};
                        for (const k of Object.keys(prev)) nextVal[k] = prev[k].map((it) => (it.id === selectedServis.id ? updatedItem : it));
                        return nextVal;
                      });
                      setEditOpen(false);
                    }}
                    onCancel={() => setEditOpen(false)}
                  />
                ) : null}
              </div>
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><XIcon className="size-4" /></DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Delete confirm */}
      <DialogPrimitive.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg">
            <DialogPrimitive.Title className="font-semibold">Hapus Servis?</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">Yakin hapus <span className="font-mono font-medium">{selectedServis?.id}</span> · {selectedServis?.device}?</DialogPrimitive.Description>
            <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteOpen(false)}>Batal</Button><Button variant="destructive" onClick={confirmDelete}>Hapus</Button></div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Bulk Ubah Status - only when same status */}
      <DialogPrimitive.Root open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg">
            <DialogPrimitive.Title className="font-semibold">Ubah Status Massal</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              {selectedCount} servis dengan status <span className="font-medium text-foreground">{currentBulkStatus}</span> akan diubah. Pilih status baru:
            </DialogPrimitive.Description>
            <div className="mt-4 space-y-3">
              <div className="grid gap-1.5">
                <Label>Status baru</Label>
                <Select value={bulkStatusOpen ? (currentBulkStatus as string) : undefined} onValueChange={(v) => { if (v) handleBulkStatus(v as Stage); }}>
                  <SelectTrigger><SelectValue placeholder="Pilih status" /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.key} value={s.key} disabled={s.key === currentBulkStatus}>
                        {s.label} {s.key === currentBulkStatus && "(saat ini)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBulkStatusOpen(false)}>Batal</Button>
              </div>
              {!canBulkStatus && <p className="text-xs text-amber-600">Pilih servis dengan status sama untuk ubah massal.</p>}
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Bulk Assign Teknisi */}
      <DialogPrimitive.Root open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg">
            <DialogPrimitive.Title className="font-semibold">Assign Teknisi Massal</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">Assign {selectedCount} servis ke teknisi:</DialogPrimitive.Description>
            <div className="mt-4 space-y-3">
              <div className="grid gap-1.5">
                <Label>Teknisi</Label>
                <Select value={bulkTeknisi} onValueChange={(v) => { if (v) setBulkTeknisi(v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rudi">Rudi</SelectItem>
                    <SelectItem value="Sari">Sari</SelectItem>
                    <SelectItem value="—">— (Unassigned)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>Batal</Button>
                <Button onClick={handleBulkAssign}>Assign {selectedCount} servis</Button>
              </div>
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Bulk Kirim Invoice WA */}
      <DialogPrimitive.Root open={bulkInvoiceOpen} onOpenChange={setBulkInvoiceOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg">
            <DialogPrimitive.Title className="font-semibold">Kirim Invoice via WhatsApp</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">Kirim invoice untuk {selectedCount} servis terpilih ke WhatsApp customer.</DialogPrimitive.Description>
            <div className="mt-3 max-h-40 overflow-y-auto rounded border bg-muted/30 p-2 text-xs space-y-1">
              {selectedData.slice(0, 5).map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span className="font-mono">{s.id}</span>
                  <span>
                    {s.device} — {formatCurrencyPlain(s.price)} {s.price === 0 && <span className="text-amber-600">(harga 0 dilewati)</span>}
                  </span>
                </div>
              ))}
              {selectedData.length > 5 && <div className="text-muted-foreground">+{selectedData.length - 5} lainnya</div>}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkInvoiceOpen(false)}>Batal</Button>
              <Button onClick={handleBulkInvoice}>Kirim WA</Button>
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Bulk Print */}
      <DialogPrimitive.Root open={bulkPrintOpen} onOpenChange={setBulkPrintOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg">
            <DialogPrimitive.Title className="font-semibold">Print Massal</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">Print {selectedCount} servis dalam satu window (combined).</DialogPrimitive.Description>
            <div className="mt-4 space-y-3">
              <div className="grid gap-1.5">
                <Label>Tipe Print</Label>
                <Select value={bulkPrintType} onValueChange={(v) => { if (v) setBulkPrintType(v as any); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dot Matrix">Dot Matrix</SelectItem>
                    <SelectItem value="Jet">Jet</SelectItem>
                    <SelectItem value="Thermal">Thermal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBulkPrintOpen(false)}>Batal</Button>
                <Button onClick={() => handleBulkPrint(bulkPrintType)}>Print {selectedCount} servis</Button>
              </div>
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Bulk Delete */}
      <DialogPrimitive.Root open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-lg">
            <DialogPrimitive.Title className="font-semibold">Hapus {selectedCount} Servis?</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">Tindakan tidak bisa dibatalkan. Daftar ID:</DialogPrimitive.Description>
            <div className="mt-3 max-h-32 overflow-y-auto rounded border bg-muted/30 p-2 font-mono text-xs">
              {selectedData.map((s) => (
                <div key={s.id}>{s.id} · {s.device}</div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Batal</Button>
              <Button variant="destructive" onClick={handleBulkDelete}>Hapus {selectedCount} servis</Button>
            </div>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-4" /></DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Sparepart popover saat Dikerjakan */}
      <SparepartPickDialog
        open={sparepartOpen}
        onOpenChange={setSparepartOpen}
        servis={sparepartTarget}
        mode="transition"
        onSuccess={() => {
          if (sparepartTarget) applyLocalStatus(sparepartTarget, "Dikerjakan");
        }}
      />
      {/* Batal setelah Dikerjakan -> Kembalikan ke stok atau tetap terpakai */}
      <CancelSparepartDialog
        open={cancelOpen}
        onOpenChange={(v) => {
          setCancelOpen(v);
          if (!v) setPendingBatal(null);
        }}
        servis={cancelTarget}
        onSuccess={() => {
          if (pendingBatal) applyLocalStatus(pendingBatal, "Batal");
          setPendingBatal(null);
        }}
      />
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
            <div className={"flex size-5 items-center justify-center rounded-full border text-[10px] " + (current ? "border-primary bg-primary text-primary-foreground" : reached ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-border bg-muted text-muted-foreground/60")} aria-label={s.label} title={s.label}><Icon className="size-3" /></div>
            {i < STAGES.length - 1 ? <div className={"h-px w-2 " + (i < idx ? "bg-emerald-500/40" : "bg-border")} /> : null}
          </div>
        );
      })}
    </div>
  );
}