/**
 * Struk thermal 58mm untuk ringkasan shift.
 *
 * Berbeda dengan `renderThermalHtml` di `print-templates.tsx` yang mencetak
 * nota servis lengkap, struk ini hanya ringkasan: total per sumber dan angka
 * kas. Struk thermal sempit dan tujuannya jadi catatan cepat di laci, bukan
 * laporan yang dibaca ulang. Laporan lengkap tetap ada di Laporan Shift dan
 * tombol PDF di sana.
 *
 * Format (58mm, monospace, pemisah putus-putus) mengikuti `renderThermalHtml`
 * supaya dua struk dari app ini terlihat berasal dari satu keluarga.
 *
 * Cetak lewat dialog cetak browser, bukan driver printer: sama seperti seluruh
 * cetak di app ini. Struk thermal dipilih sebagai printer tujuan di dialog itu.
 */

import { rupiah, type ShiftReport } from "@/lib/operational/laporan-shift";
import { printShiftReceipt } from "@/lib/printer";

/** Jam toko dalam zona waktu cabang. */
function clockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  // `en-GB`, bukan `id-ID`: id-ID memakai titik sebagai pemisah jam, sehingga
  // jam 10 Output "10.00" dan "23.59" - di struk sekecil ini keduanya terbaca
  // seperti angka desimal. en-GB memakai titik dua, sesuai kolom jam di struk
  // nota servis.
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** Tanggal + jam WIB, untuk header dan baris "Dicetak". */
function stampTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  return `${day} ${clockTime(iso)}`;
}

function durationText(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}j ${total % 60}m`;
}

/** Baris label/kolor nilai. Nilai selalu dirata-kanan agar kolom rupiah lurus. */
function row(label: string, value: string): string {
  return `<div class="row"><span>${escapeHtml(label)}</span><span class="n">${escapeHtml(value)}</span></div>`;
}

/**
 * HTML struk ringkasan shift.
 *
 * Semua nilai dari laporan masuk lewat `escapeHtml`. `reason` ditulis sendiri
 * oleh frontliner, jadi isinya bukan data tepercaya - tanpa escaping, satu
 * karakter `<` membatalkan seluruh markup struk.
 */
export function renderShiftThermalHtml(report: ShiftReport): string {
  const { totals } = report;

  // Tanda untuk kas manual diambil dari `rupiah()` sendiri, bukan ditambahkan
  // di sini. `Intl` sudah menaruh tanda minus sebelum "Rp" (sehingga
  // "-Rp 40.000"), jadi kalau tanda ditambahkan lagi hasilnya "+ Rp 40.000"
  // untuk pengeluaran - tanda maju, sementara selisih di bawah tampil
  // "-Rp 40.000" - tanda mundur. Dua bentuk tanda dalam satu struk.
  const manualNet = rupiah(totals.manualNet);

  // Selisih boleh null kalau saldo akhir belum diisi, walau pada alur Tutup
  // Toko normalnya sudah terisi. Struk tetap dicetak dengan "—" supaya
  // struknya tidak berlubang di tengah.
  const variance = report.variance === null ? "—" : rupiah(report.variance);
  const closing = report.closingBalance === null ? "—" : rupiah(report.closingBalance);

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Ringkasan Shift ${escapeHtml(
    report.date,
  )}</title>
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
  @media print{ body{ width:58mm; margin:0; } }
</style>
</head><body>
  <div class="center bold" style="font-size:12px;">RINGKASAN SHIFT</div>
  <div class="center">${escapeHtml(report.branchName)}</div>
  <div class="center" style="font-size:9px;">${escapeHtml(report.date)}</div>
  <hr class="sep">
  ${row("Open Shift", stampTime(report.openAt))}
  ${row("Open By", report.employeeName)}
  ${row("Close Shift", stampTime(report.closingAt))}
  ${row("Close By", report.closedByName?.trim() || "—")}
  ${row("Total Duration", durationText(report.durationMinutes ?? 0))}
  <hr class="sep">
  ${report.spareparts && report.spareparts.length > 0
    ? `<div class="bold">Sparepart terpakai</div>
  ${report.spareparts.map((part) => row(part.name, `x${part.qty}`)).join("\n  ")}
  <hr class="sep">`
    : ""}
  ${row("Servis Masuk", String(report.serviceStats?.masuk ?? report.services.length))}
  ${(report.serviceStats?.selesai ?? 0) > 0 ? row("Servis Selesai", String(report.serviceStats?.selesai)) : ""}
  ${(report.serviceStats?.diambil ?? 0) > 0 ? row("Diambil", String(report.serviceStats?.diambil)) : ""}
  ${(report.serviceStats?.batal ?? 0) > 0 ? row("Batal", String(report.serviceStats?.batal)) : ""}
  <hr class="sep">
  ${row("Saldo awal", rupiah(report.openingBalance))}
  ${row(`Servis (${report.services.length})`, rupiah(totals.services))}
  ${row(`Penjualan (${report.sales.length})`, rupiah(totals.sales))}
  ${row("Kas manual", manualNet)}
  <hr class="sep">
  ${row("Harus ada", rupiah(totals.expected))}
  ${row("Saldo akhir", closing)}
  ${row("Selisih", variance)}
  ${report.reason ? `<hr class="sep"><div class="note">${escapeHtml(report.reason)}</div>` : ""}
  <hr class="sep">
  <div class="center" style="font-size:8px;">Dicetak ${escapeHtml(stampTime(new Date().toISOString()))}</div>
</body></html>`;
}

/**
 * Buka dialog cetak untuk struk thermal shift.
 *
 * Iframe tersembunyi dipakai sebagai konteks cetak, sama seperti
 * `shift-export-bar.tsx`. `document.write` langsung di halaman utama tidak
 * dipakai karena akan mengganti isi dokumen aplikasi.
 *
 * Mengembalikan `false` kalau konteks cetak tidak tersedia, supaya pemanggil
 * bisa memberi tahu alih-alih diam saja.
 */
export function printShiftThermal(report: ShiftReport): boolean {
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
    doc.write(renderShiftThermalHtml(report));
    doc.close();

    // Beri frame kesempatan memuat stylesheet sebelum dialog cetak dibuka.
    // Tanpa jeda, beberapa browser mencetak halaman kosong.
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

/**
 * Cetak struk shift: langsung ke printer yang tersimpan, atau dialog browser.
 *
 * Printer langsung (Bluetooth/serial/RawBT) tidak butuh dialog sama sekali.
 * Kalau belum ada transport atau pengiriman gagal, struk tetap keluar lewat
 * dialog cetak browser supaya shift tidak tutup tanpa catatan.
 */
export async function printShiftReport(report: ShiftReport): Promise<boolean> {
  try {
    await printShiftReceipt(report);
    return true;
  } catch {
    return printShiftThermal(report);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}