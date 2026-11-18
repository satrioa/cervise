import { Wrench, Package, ShoppingCart, Banknote, Search, ChevronDown } from "lucide-react";

/* ── Servis Mock ── */

const services = [
  { device: "iPhone 15 Pro", ticket: "#SV-2401", status: "masuk", statusColor: "bg-blue-500" },
  { device: "Samsung S24", ticket: "#SV-2402", status: "diagnosa", statusColor: "bg-purple-500" },
  { device: "MacBook Air", ticket: "#SV-2403", status: "perbaikan", statusColor: "bg-amber-500" },
  { device: "iPad Pro M4", ticket: "#SV-2404", status: "selesai", statusColor: "bg-emerald-500" },
  { device: "AirPods Pro", ticket: "#SV-2405", status: "qc", statusColor: "bg-cyan-500" },
];

export function ServisMock() {
  return (
    <div className="flex h-full flex-col bg-[#0c0a0e] p-3">
      <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
        <Search className="size-3 text-white/30" />
        <span className="text-[10px] text-white/25">Cari servis, pelanggan, perangkat...</span>
        <div className="ml-auto flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.04] px-1.5 py-0.5">
          <ChevronDown className="size-2.5 text-white/30" />
        </div>
      </div>
      <div className="mt-2 flex gap-1">
        <div className="flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-0.5">
          <span className="size-1.5 rounded-full bg-blue-500" />
          <span className="text-[9px] text-white/40">Masuk</span>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-0.5">
          <span className="size-1.5 rounded-full bg-purple-500" />
          <span className="text-[9px] text-white/40">Diagnosa</span>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-0.5">
          <span className="size-1.5 rounded-full bg-amber-500" />
          <span className="text-[9px] text-white/40">Perbaikan</span>
        </div>
      </div>
      <div className="mt-2 flex-1 space-y-1">
        <div className="flex items-center gap-1.5 border-b border-white/[0.04] pb-1 text-[8px] text-white/20">
          <span className="w-6" />
          <span className="flex-1">Perangkat</span>
          <span className="w-14 text-right">Tiket</span>
        </div>
        {services.map((s) => (
          <div key={s.ticket} className="flex items-center gap-1.5 rounded-md px-1 py-1 hover:bg-white/[0.03]">
            <span className={`inline-block size-1.5 shrink-0 rounded-full ${s.statusColor}`} />
            <span className="flex-1 truncate text-[10px] text-white/80">{s.device}</span>
            <span className="w-14 text-right text-[9px] text-white/40">{s.ticket}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Inventory Mock ── */

const invItems = [
  { name: "LCD iPhone 13", qty: 12, status: "Aman", badgeColor: "bg-emerald-500/20 text-emerald-400" },
  { name: "Baterai Samsung S24", qty: 3, status: "Menipis", badgeColor: "bg-amber-500/20 text-amber-400" },
  { name: "Touch IC iPad", qty: 0, status: "Habis", badgeColor: "bg-red-500/20 text-red-400" },
  { name: "Kabel Flex", qty: 25, status: "Aman", badgeColor: "bg-emerald-500/20 text-emerald-400" },
];

export function InventoryMock() {
  return (
    <div className="flex h-full flex-col bg-[#0c0a0e] p-3">
      <div className="flex gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.03] p-0.5">
        {["Sparepart", "Produk", "Unit Baru"].map((tab, i) => (
          <div
            key={tab}
            className={`rounded-md px-2 py-1 text-[9px] ${i === 0 ? "bg-white/10 text-white/80" : "text-white/30"}`}
          >
            {tab}
          </div>
        ))}
      </div>
      <div className="mt-2 flex-1 space-y-1">
        <div className="flex items-center gap-2 border-b border-white/[0.04] pb-1 text-[8px] text-white/20">
          <span className="flex-1">Nama Item</span>
          <span className="w-6 text-right">Qty</span>
          <span className="w-12 text-right">Status</span>
        </div>
        {invItems.map((item) => (
          <div key={item.name} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-white/[0.03]">
            <span className="flex-1 truncate text-[10px] text-white/80">{item.name}</span>
            <span className="w-6 text-right text-[10px] text-white/60">{item.qty}</span>
            <span className={`w-12 rounded px-1 py-0.5 text-right text-[8px] font-medium ${item.badgeColor}`}>
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── POS Mock ── */

const posProducts = [
  { name: "LCD iPhone 13", price: "Rp 850k" },
  { name: "Baterai 25R", price: "Rp 120k" },
  { name: "Tempered Glass", price: "Rp 25k" },
  { name: "Charger 20W", price: "Rp 89k" },
];

const cartItems = [
  { name: "LCD iPhone 13", qty: 1, price: "850k" },
  { name: "Tempered Glass", qty: 2, price: "50k" },
];

export function PosMock() {
  return (
    <div className="flex h-full gap-2 bg-[#0c0a0e] p-3">
      <div className="flex flex-1 flex-col">
        <div className="mb-1.5 flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1">
          <Search className="size-2.5 text-white/30" />
          <span className="text-[8px] text-white/25">Cari produk...</span>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-1">
          {posProducts.slice(0, 4).map((p) => (
            <div
              key={p.name}
              className="flex flex-col justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5"
            >
              <span className="text-[9px] text-white/70">{p.name}</span>
              <span className="text-[8px] text-primary/70">{p.price}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="w-26 flex flex-col rounded-lg border border-white/[0.06] bg-white/[0.03] p-2">
        <div className="flex items-center gap-1 border-b border-white/[0.06] pb-1">
          <ShoppingCart className="size-3 text-primary/70" />
          <span className="text-[9px] text-white/50">Keranjang</span>
          <span className="ml-auto rounded-full bg-primary/20 px-1 text-[8px] text-primary/70">2</span>
        </div>
        <div className="mt-1 flex-1 space-y-1">
          {cartItems.map((ci) => (
            <div key={ci.name} className="flex items-center justify-between">
              <span className="truncate text-[8px] text-white/60">{ci.name}</span>
              <span className="text-[8px] text-white/70">{ci.qty}x</span>
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-1">
          <span className="text-[8px] text-white/40">Total</span>
          <span className="text-[9px] font-semibold text-white/80">Rp 900k</span>
        </div>
        <div className="mt-1 rounded-md bg-primary/80 px-2 py-1 text-center text-[8px] font-medium text-white">
          Bayar
        </div>
      </div>
    </div>
  );
}

/* ── Laporan Mock ── */

const kpiCards = [
  { label: "Total Pendapatan", value: "Rp 128,5jt", color: "text-emerald-400" },
  { label: "Pendapatan Servis", value: "Rp 74,2jt", color: "text-blue-400" },
  { label: "Pendapatan POS", value: "Rp 42,0jt", color: "text-violet-400" },
  { label: "Laba Bersih", value: "Rp 32,8jt", color: "text-emerald-400" },
  { label: "Piutang Servis", value: "Rp 3,2jt", color: "text-rose-400" },
];

export function LaporanMock() {
  return (
    <div className="flex h-full flex-col bg-[#0c0a0e] p-3">
      <div className="flex items-center gap-1.5">
        <div className="rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[8px] text-white/50">
          Hari ini
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[8px] text-white/50">
          7 Hari
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.06] px-2 py-0.5 text-[8px] text-white/70">
          Bulan ini
        </div>
      </div>
      <div className="mt-2 grid flex-1 grid-cols-2 gap-1">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className="flex flex-col justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1"
          >
            <span className="text-[8px] text-white/40">{kpi.label}</span>
            <span className={`text-[11px] font-semibold ${kpi.color}`}>{kpi.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tab Icons ── */

export const mockIcons = [Wrench, Package, ShoppingCart, Banknote];
