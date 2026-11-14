/**
 * Struk thermal 58mm untuk laporan tutup toko (detail).
 * Dipakai sebagai fallback dialog cetak browser bila printer langsung tidak tersedia.
 */

import { rupiah, type ShiftReport } from "@/lib/operational/laporan-shift";
import { printShiftReceipt } from "@/lib/printer";
import { getReceiptAppearance } from "@/app/app/pengaturan/tampilan/actions";

export type ShiftPrintAppearance = {
  logoUrl?: string | null;
  footerText?: string | null;
  tenantName?: string | null;
};

/** Jam/tanggal WIB. */
function stampTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${day} ${time}`;
}

function durationText(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}j ${total % 60}m`;
}

function row(label: string, value: string): string {
  return `<div class="row"><span>${escapeHtml(label)}</span><span class="n">${escapeHtml(value)}</span></div>`;
}

function paymentMethodBreakdown(report: ShiftReport): { label: string; value: number }[] {
  const byMethod = new Map<string, number>();
  for (const sale of report.sales) {
    const key = sale.method?.trim() || "Tanpa metode";
    byMethod.set(key, (byMethod.get(key) ?? 0) + sale.paid);
  }
  const rows = [...byMethod.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
  const serviceCounted = report.services.filter((s) => s.counted).reduce((sum, s) => sum + s.amount, 0);
  if (serviceCounted > 0) rows.push({ label: "Servis (tanpa penjualan)", value: serviceCounted });
  return rows;
}

/** HTML struk laporan tutup toko (detail). */
export function renderShiftThermalHtml(report: ShiftReport, appearance: ShiftPrintAppearance = {}): string {
  const { totals } = report;
  const tenantName = appearance.tenantName?.trim() || report.branchName;
  const variance = report.variance === null ? "—" : rupiah(report.variance);
  const closing = report.closingBalance === null ? "—" : rupiah(report.closingBalance);
  const breakdown = paymentMethodBreakdown(report);
  const stats = report.serviceStats ?? { masuk: report.services.length, selesai: 0, diambil: 0, batal: 0 };

  const salesHtml =
    report.sales.length === 0
      ? `<div class="note">-</div>`
      : report.sales
          .map((s) => {
            const meta = [s.settled ? "lunas" : "belum bayar", s.method?.trim() || null].filter(Boolean).join(" · ");
            const received = s.paid !== s.amount ? row("Diterima", rupiah(s.paid)) : "";
            return `<div class="item"><div class="bold">${escapeHtml(s.label)}</div><div class="note">${escapeHtml(meta)}</div>${row("Total", rupiah(s.amount))}${received}</div>`;
          })
          .join("");

  const servicesHtml =
    report.services.length === 0
      ? `<div class="note">-</div>`
      : report.services
          .map((s) => {
            const note = s.counted ? s.status : `${s.status} · lewat penjualan`;
            return `<div class="item"><div class="bold">${escapeHtml(s.label)}</div><div class="note">${escapeHtml(note)}</div>${row("Nominal", rupiah(s.amount))}</div>`;
          })
          .join("");

  const cashHtml =
    report.cashTx.length === 0
      ? `<div class="note">-</div>`
      : report.cashTx
          .map((tx) => {
            const sign = tx.direction === "pemasukan" ? "+" : "-";
            const meta = [tx.source, tx.metode].filter(Boolean).join(" · ");
            return `<div class="item"><div class="bold">${escapeHtml(`${sign} ${tx.label}`)}</div>${meta ? `<div class="note">${escapeHtml(meta)}</div>` : ""}${row("Nominal", rupiah(tx.amount))}</div>`;
          })
          .join("");

  const breakdownHtml =
    breakdown.length === 0
      ? `<div class="note">-</div>`
      : breakdown.map((b) => row(b.label, rupiah(b.value))).join("\n  ");

  const footer = appearance.footerText?.trim()
    ? `<div class="center note" style="margin-top:4px;">${escapeHtml(appearance.footerText.trim())}</div>`
    : "";

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan Tutup Toko ${escapeHtml(report.date)}</title>
<style>
  @page { size: 58mm auto; margin: 0; }
  *{box-sizing:border-box;}
  body{ font-family:'Courier New',Courier,monospace; font-size:11px; line-height:1.35; width:58mm; max-width:58mm; margin:0 auto; padding:3mm 2mm; color:#000; -webkit-print-color-adjust:exact; }
  .center{ text-align:center; }
  .bold{ font-weight:700; }
  .sep{ border:none; border-top:1px dashed #000; margin:6px 0; }
  .row{ display:flex; justify-content:space-between; gap:4px; }
  .n{ white-space:nowrap; font-variant-numeric:tabular-nums; }
  .note{ font-size:9px; word-break:break-word; }
  .item{ margin:4px 0; }
  .pill{ display:inline-block; border:1px solid #000; border-radius:999px; padding:1px 8px; font-size:10px; margin-top:2px; }
  @media print{ body{ width:58mm; margin:0; } }
</style>
</head><body>
  ${appearance.logoUrl ? `<div class="center" style="margin-bottom:4px;"><img src="${escapeHtml(appearance.logoUrl)}" alt="" style="max-height:36px; max-width:120px; object-fit:contain;" /></div>` : ""}
  <div class="center bold" style="font-size:12px;">LAPORAN TUTUP TOKO</div>
  <div class="center bold">${escapeHtml(tenantName)}</div>
  ${appearance.tenantName?.trim() && report.branchName ? `<div class="center"><span class="pill">${escapeHtml(report.branchName)}</span></div>` : ""}
  <div class="center" style="font-size:9px;">${escapeHtml(report.date)}</div>
  <hr class="sep">
  ${row("Open Shift", stampTime(report.openAt))}
  ${row("Open By", report.employeeName)}
  ${row("Close Shift", stampTime(report.closingAt))}
  ${row("Close By", report.closedByName?.trim() || "—")}
  ${row("Total Duration", durationText(report.durationMinutes ?? 0))}
  <hr class="sep">
  ${report.spareparts && report.spareparts.length > 0 ? `<div class="bold">Sparepart terpakai</div>${report.spareparts.map((p) => row(p.name, `x${p.qty}`)).join("")}<hr class="sep">` : ""}
  ${row("Servis Masuk", String(stats.masuk))}
  ${stats.selesai > 0 ? row("Servis Selesai", String(stats.selesai)) : ""}
  ${stats.diambil > 0 ? row("Diambil", String(stats.diambil)) : ""}
  ${stats.batal > 0 ? row("Batal", String(stats.batal)) : ""}
  <hr class="sep">
  <div class="bold">DETAIL PENJUALAN (${report.sales.length})</div>
  ${salesHtml}
  <hr class="sep">
  <div class="bold">DETAIL SERVIS (${report.services.length})</div>
  ${servicesHtml}
  <hr class="sep">
  <div class="bold">KAS MANUAL (${report.cashTx.length})</div>
  ${cashHtml}
  <hr class="sep">
  <div class="bold">PENDAPATAN / METODE</div>
  ${breakdownHtml}
  <hr class="sep">
  ${row("Saldo awal", rupiah(report.openingBalance))}
  ${row(`Servis (${report.services.length})`, rupiah(totals.services))}
  ${row(`Penjualan (${report.sales.length})`, rupiah(totals.sales))}
  ${row("Masuk manual", rupiah(totals.manualIn))}
  ${row("Keluar manual", rupiah(totals.manualOut))}
  ${row("Kas manual", rupiah(totals.manualNet))}
  <hr class="sep">
  ${row("Harus ada", rupiah(report.expectedCash))}
  ${row("Saldo akhir", closing)}
  ${row("Selisih", variance)}
  ${report.reason ? `<hr class="sep"><div class="note">${escapeHtml(report.reason)}</div>` : ""}
  <hr class="sep">
  ${footer}
  <div class="center" style="font-size:8px;">Dicetak ${escapeHtml(stampTime(new Date().toISOString()))}</div>
</body></html>`;
}

async function resolveAppearance(appearance?: ShiftPrintAppearance): Promise<ShiftPrintAppearance> {
  if (appearance && (appearance.logoUrl !== undefined || appearance.footerText !== undefined || appearance.tenantName !== undefined)) {
    return appearance;
  }
  try {
    const a = await getReceiptAppearance();
    return { logoUrl: a.logoUrl, footerText: a.footerText, tenantName: null, ...(appearance ?? {}) };
  } catch {
    return appearance ?? {};
  }
}

/** Buka dialog cetak browser untuk struk shift (fallback). */
export function printShiftThermal(report: ShiftReport, appearance: ShiftPrintAppearance = {}): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  frame.style.right = "0";
  frame.style.bottom = "0";

  document.body.appendChild(frame);

  try {
    const doc = frame.contentDocument;
    if (!doc) {
      frame.remove();
      return false;
    }
    doc.open();
    doc.write(renderShiftThermalHtml(report, appearance));
    doc.close();

    window.setTimeout(() => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } finally {
        frame.remove();
      }
    }, 100);

    return true;
  } catch {
    frame.remove();
    return false;
  }
}

/** Cetak struk shift: langsung ke printer terhubung, fallback dialog browser. */
export async function printShiftReport(report: ShiftReport, appearance?: ShiftPrintAppearance): Promise<boolean> {
  const resolved = await resolveAppearance(appearance);
  try {
    await printShiftReceipt(report, {
      logoUrl: resolved.logoUrl,
      footerText: resolved.footerText,
      tenantName: resolved.tenantName,
    });
    return true;
  } catch {
    return printShiftThermal(report, resolved);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
