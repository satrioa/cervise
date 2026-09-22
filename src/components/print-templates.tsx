"use client";

import { format } from "date-fns";

type PrintData = {
  branch: { name: string; address: string; phone: string; website: string };
  invoiceNo: string;
  service: {
    id: string;
    device: string;
    merk?: string;
    tipe?: string;
    imei1?: string;
    imei2?: string;
    kelengkapan?: string[];
    kerusakan?: string[];
    deskripsi?: string;
    sparepart?: string;
    price: number;
    status: string;
    teknisi: string;
    complaint?: string;
    date: string;
    garansiSampai?: string;
    tanggalTerima?: string;
    passwordType?: string;
    passwordValue?: string;
  };
  customer: { name: string; phone: string };
  admin: string;
  teknisi: string;
  printTime: string;
};

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.replace(/^0/, "62").replace(/^8/, "62");
  if (normalized.length < 10) return phone;
  return normalized.replace(/(\d{3})\d{4}(\d+)/, (_, a, b) => `${a}****${b}`.replace("+", ""));
  // keep +62 prefix for display
}

function formatPhoneDisplay(phone: string): string {
  const masked = maskPhone(phone);
  return masked.startsWith("62") ? `+${masked}` : masked;
}

function formatEn(price: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);
}

function formatInvoiceNo(date: string | Date): string {
  const d = new Date(date);
  return `INV-${format(d, "ddMMyyyyHHmmss")}`;
}

export function toPrintData(
  servis: any,
  branch: { label: string; meta?: string },
  detail?: any
): PrintData {
  // Prefer detail (ServisDetail) if available, else fallback to ServisItem dummy
  const s = detail || servis;
  const customerName = s?.cervise_customers?.name || s?.customer?.split("·")[0]?.trim() || s?.customer || "FARHAN";
  const customerPhoneRaw = s?.cervise_customers?.phone || s?.customer?.split("·")[1]?.trim() || "0896****2404";
  const merk = s?.merk || s?.device?.split(" ")[0] || "IPHONE";
  const tipe = s?.tipe || s?.device?.split(" ").slice(1).join(" ") || "11";
  const imei1 = s?.imei1 ?? "0";
  const imei2 = s?.imei2 ?? "-";
  const kelengkapan = Array.isArray(s?.kelengkapan) ? s.kelengkapan : s?.kelengkapan ? [s.kelengkapan] : ["SIMTRAY"];
  const kerusakan = Array.isArray(s?.kerusakan) ? s.kerusakan : s?.kerusakan ? [s.kerusakan] : s?.complaint ? [s.complaint] : ["REPAIR KAMERA BELAKANG"];
  const deskripsi = s?.deskripsi || s?.password_value || "1111";
  const sparepart = s?.sparepart || "TIDAK";
  const price = s?.price ?? 200000;
  const status = s?.status || "Masuk";
  const teknisiName = s?.teknisi?.full_name || s?.teknisi || "Teknisitasik1";
  const adminName = s?.creator?.full_name || "Kasservice indonesia";
  const createdAt = s?.created_at || s?.date || new Date().toISOString();
  const tanggalTerima = format(new Date(createdAt), "yyyy-MM-dd");
  const garansiSampai = s?.garansi_until ? format(new Date(s.garansi_until), "yyyy-MM-dd") : "2026-09-30";
  const invoiceNo = s?.invoice_no || formatInvoiceNo(createdAt);

  // Branch mapping: use branch label as store name, fallback
  const branchName = branch?.label === "Semua cabang" ? "KasserviceKlaten" : branch?.label || "KasserviceKlaten";
  const branchAddress = "Jl.Mayor Kusmanto Proliman 113 ( Bramen )";
  const branchPhone = "+62088245238197";
  const branchWebsite = "https://rbm-borneo.com/Store/KasserviceKlaten";

  return {
    branch: { name: branchName, address: branchAddress, phone: branchPhone, website: branchWebsite },
    invoiceNo,
    service: {
      id: s?.id || "SV-1001",
      device: `${merk} ${tipe}`.trim(),
      merk,
      tipe,
      imei1: String(imei1),
      imei2: String(imei2 ?? "-"),
      kelengkapan,
      kerusakan,
      deskripsi: String(deskripsi),
      sparepart: String(sparepart),
      price,
      status,
      teknisi: teknisiName,
      complaint: s?.complaint || kerusakan.join(", "),
      date: tanggalTerima,
      garansiSampai,
      tanggalTerima,
      passwordType: s?.password_type || "POLA",
      passwordValue: s?.password_value || "1,2,5",
    },
    customer: { name: String(customerName).toUpperCase(), phone: String(customerPhoneRaw) },
    admin: adminName,
    teknisi: teknisiName,
    printTime: format(new Date(), "dd/MM/yyyy, HH:mm"),
  };
}

function renderPolaSvg(passwordValue?: string): string {
  if (!passwordValue) return "";
  const indices = passwordValue
    .split(",")
    .map((s) => {
      let n = parseInt(s.trim(), 10);
      if (!isNaN(n) && n >= 1 && n <= 9) n = n - 1;
      return n;
    })
    .filter((n) => !isNaN(n) && n >= 0 && n <= 8);
  if (indices.length === 0) return "";
  const pos = (idx: number) => ({ x: (idx % 3) * 33.33 + 16.66, y: Math.floor(idx / 3) * 33.33 + 16.66 });
  const lines = indices
    .slice(0, -1)
    .map((_, i) => {
      const a = pos(indices[i]);
      const b = pos(indices[i + 1]);
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#111827" stroke-width="1.6" stroke-linecap="round"/>`;
    })
    .join("");
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style="position:absolute; top:0; left:0; right:0; bottom:0; width:100%; height:100%; padding:4px; pointer-events:none;">${lines}</svg>`;
}

function renderPolaDotsHtml(passwordValue?: string): string {
  const indices = (passwordValue || "")
    .split(",")
    .map((s) => {
      let n = parseInt(s.trim(), 10);
      if (!isNaN(n) && n >= 1 && n <= 9) n = n - 1;
      return n;
    })
    .filter((n) => !isNaN(n) && n >= 0 && n <= 8);
  return Array.from({ length: 9 }, (_, i) => {
    const active = indices.includes(i);
    const order = indices.indexOf(i);
    const label = active ? String(order + 1) : String(i + 1);
    return `<div class="pola-dot${active ? " active" : ""}"><i>${label}</i></div>`;
  }).join("");
}

// JET - A4, system-ui, 8-col table, pola, signatures
export function renderJetHtml(data: PrintData): string {
  const { branch, invoiceNo, service, customer, admin, teknisi, printTime } = data;
  const kerusakanStr = (service.kerusakan || []).join(", ").toUpperCase() || service.complaint?.toUpperCase() || "REPAIR KAMERA BELAKANG";
  const kelengkapanStr = (service.kelengkapan || []).join(", ").toUpperCase() || "SIMTRAY";
  const polaSvg = service.passwordType === "POLA" ? renderPolaSvg(service.passwordValue) : "";
  const maskedCustomerPhone = formatPhoneDisplay(customer.phone);
  const maskedBranchPhone = branch.phone;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Print ${invoiceNo} — Jet</title>
<style>
  @page { size: A4 portrait; margin: 12mm 12mm 14mm 12mm; }
  * { box-sizing: border-box; }
  html,body { margin:0; padding:0; }
  body { font-family: Helvetica, Arial, "Segoe UI", sans-serif; font-size: 9pt; line-height:1.45; color:#111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; background:#fff; }
  .page { width:210mm; min-height:297mm; margin:0 auto; padding:12mm; display:flex; flex-direction:column; position:relative; }
  @media print { body{padding:0;} .page{margin:0; border:none; box-shadow:none; width:auto; min-height:auto;} .no-print{display:none;} }
  .top-bar{ height:4px; background:#111827; margin:-12mm -12mm 12px -12mm; }
  .header-store{ text-align:center; margin-bottom:6px; }
  .header-store h1{ font-size:17pt; font-weight:700; letter-spacing:.02em; margin:0; }
  .invoice-label{ font-family: ui-monospace, monospace; font-size:8pt; letter-spacing:.28em; text-transform:uppercase; color:#6b7280; text-align:center; margin-top:4px; }
  .invoice-no{ text-align:center; font-family: ui-monospace, monospace; font-size:13pt; font-weight:700; letter-spacing:.04em; margin:2px 0 8px; }
  .rule{ border:none; border-top:1.5px solid #111827; margin:6px 0 8px; }
  table.jet{ width:100%; border-collapse:collapse; font-size:7.5pt; }
  table.jet th{ background:#111827; color:#fff; font-weight:700; text-transform:uppercase; letter-spacing:.04em; border:1px solid #111827; padding:5px 6px; text-align:center; }
  table.jet td{ border:1px solid #111827; padding:5px 6px; text-align:center; }
  table.jet td.kerusakan{ text-align:left; }
  table.jet td.harga{ text-align:right; font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums; }
  .info{ margin-top:10px; font-size:8.5pt; line-height:1.55; }
  .info .row{ display:grid; grid-template-columns: 110px 8px minmax(0,1fr); column-gap:8px; padding:1px 0 1px 10px; position:relative; align-items:baseline; min-width:0; }
  .info .label{ color:#111827; white-space:nowrap; }
  .info .colon{ text-align:center; white-space:nowrap; }
  .info .val{ min-width:0; overflow-wrap:break-word; word-break:normal; }
  .info .val.phone{ white-space:nowrap; word-break:keep-all; overflow-wrap:normal; }
  .info .val.url{ overflow-wrap:anywhere; word-break:break-all; }
  .info .row.bullet::before{ content:"●"; position:absolute; left:0; top:0.45em; font-size:5pt; line-height:1; margin:0; }
  .total-row{ display:flex; justify-content:space-between; align-items:baseline; margin-top:8px; border-top:2px solid #111827; padding-top:6px; font-weight:700; }
  .total-row .payment{ font-weight:400; font-size:8.5pt; }
  .total-row .total{ font-family: ui-monospace, monospace; font-size:10pt; font-variant-numeric: tabular-nums; text-align:right; }
  .checks{ text-align:center; font-size:7.5pt; letter-spacing:.08em; margin:8px 0; }
  .checks span{ display:inline-block; border:1px solid #111827; padding:3px 10px; margin:0 4px; }
  .info > div{ min-width:0; }
  .pola{ margin-top:6px; }
  .pola h3{ font-size:8pt; letter-spacing:.04em; text-transform:none; margin:0 0 4px; font-weight:700; }
  .pola-grid{ position:relative; width:72px; height:72px; display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr); gap:4px; border:1px solid #d1d5db; padding:4px; background:#f9fafb; overflow:hidden; }
  .pola-grid svg{ position:absolute; top:0; left:0; right:0; bottom:0; width:100%; height:100%; padding:4px; pointer-events:none; }
  .pola-dot{ display:flex; align-items:center; justify-content:center; }
  .pola-dot i{ display:flex; align-items:center; justify-content:center; width:16px; height:16px; border-radius:50%; border:1px solid #d1d5db; background:#fff; font-style:normal; font-size:6.5pt; font-family: ui-monospace, monospace; }
  .pola-dot.active i{ background:#111827; color:#fff; border-color:#111827; }
  .catatan{ margin-top:10px; border-top:1px solid #111827; padding-top:6px; }
  .catatan h3{ font-size:8.5pt; font-weight:700; margin:0 0 4px; }
  .catatan ol{ margin:0; padding-left:16px; font-size:7.5pt; line-height:1.45; }
  .catatan li{ margin-bottom:1px; }
  .sigs{ display:flex; justify-content:space-between; gap:24px; margin-top:18px; }
  .sig{ flex:1; text-align:center; font-size:8.5pt; }
  .sig .role{ margin-bottom:36px; }
  .sig .name{ font-family: ui-monospace, monospace; font-size:7.5pt; }
  .footer{ margin-top:auto; padding-top:10px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; gap:8px; font-size:6pt; color:#9ca3af; font-family: ui-monospace, monospace; }
</style>
</head><body><div class="page"><div class="top-bar"></div>
  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:24px;">
    <div>
      <h1 style="font-size:18pt; font-weight:700; margin:0;">${branch.name}</h1>
      <div style="font-size:8pt; color:#6b7280; word-break:break-word;">${branch.address} · ${maskedBranchPhone}</div>
      <div style="font-size:8pt; color:#6b7280; word-break:break-all;">${branch.website}</div>
    </div>
    <div style="border:2px solid #111827; border-radius:8px; padding:8px 12px; text-align:right; align-self:flex-start; min-width:140px;">
      <div style="font-size:7pt; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.1em;">Invoice</div>
      <div style="font-size:13pt; font-weight:700; font-family:ui-monospace,monospace; letter-spacing:.02em;">${invoiceNo}</div>
      <div style="font-size:8pt; color:#6b7280;">${service.date}</div>
    </div>
  </div>
  <hr class="rule">
  <table class="jet"><thead><tr><th>Merek</th><th>Kelengkapan</th><th>Imei 1</th><th>Imei 2</th><th>Kerusakan</th><th>Deskripsi</th><th>Sparepart</th><th>Harga</th></tr></thead>
  <tbody><tr><td>${(service.merk || service.device.split(" ")[0]).toUpperCase()}</td><td>${kelengkapanStr}</td><td>${service.imei1}</td><td>${service.imei2}</td><td class="kerusakan">${kerusakanStr}</td><td>${service.deskripsi}</td><td>${service.sparepart}</td><td class="harga">${formatEn(service.price)}</td></tr></tbody></table>
  <div class="info" style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px 24px;">
    <div>
      <div class="row bullet"><span class="label">Admin</span><span class="colon">:</span><span class="val">${admin}</span></div>
      <div class="row bullet"><span class="label">Teknisi</span><span class="colon">:</span><span class="val">${teknisi}</span></div>
      <div class="row bullet"><span class="label">Telepon</span><span class="colon">:</span><span class="val phone">${maskedBranchPhone}</span></div>
      <div class="row bullet"><span class="label">Alamat</span><span class="colon">:</span><span class="val" style="overflow-wrap:break-word;">${branch.address}</span></div>
      <div class="row bullet"><span class="label">Website</span><span class="colon">:</span><span class="val url">${branch.website}</span></div>
    </div>
    <div>
      <div class="row bullet"><span class="label">Konsumen</span><span class="colon">:</span><span class="val">${customer.name}</span></div>
      <div class="row bullet"><span class="label">Telepon</span><span class="colon">:</span><span class="val phone">${maskedCustomerPhone}</span></div>
      <div class="row bullet"><span class="label">Tanggal Service</span><span class="colon">:</span><span class="val">${service.date}</span></div>
      <div class="row bullet"><span class="label">Garansi sampai</span><span class="colon">:</span><span class="val">${service.garansiSampai}</span></div>
    </div>
  </div>
  <div class="total-row"><span class="payment">Payment Cash</span><span class="total">Total &nbsp; ${formatEn(service.price)}</span></div>
  <div class="checks"><span>Cek Service</span><span>Cek Garansi</span></div>
  ${service.passwordType === "POLA" ? `<div class="pola"><h3>POLA</h3><div class="pola-grid">${polaSvg}${renderPolaDotsHtml(service.passwordValue)}</div></div>` : ""}
  <div class="catatan"><h3>Catatan :</h3><ol><li>Garansi service 2 Minggu, berlaku barang sudah diambil.</li><li>Slip ini wajib dibawa ketika akan mengambil service.</li><li>Garansi berlaku pada kerusakan yang sama.</li><li>Cek kembali barang service anda saat penyerahan.</li></ol></div>
  <div class="sigs"><div class="sig"><div class="role">Konsumen</div><div class="name">( ${customer.name} )</div></div><div class="sig"><div class="role">Admin</div><div class="name">( ${admin} )</div></div></div>
  <div class="footer"><span>${printTime} Invoice Service</span><span>https://rbm-borneo.com/User/Service/print/jet/${invoiceNo}</span><span>1/1</span></div>
</div><script>window.print();</script></body></html>`;
}

// Dot Matrix - 80 cols continuous, monospace, dashed
export function renderDotMatrixHtml(data: PrintData): string {
  const { branch, invoiceNo, service, customer, admin, teknisi, printTime } = data;
  const kelengkapanStr = (service.kelengkapan || []).join(", ").toUpperCase() || "SIMTRAY";
  const kerusakanStr = (service.kerusakan || []).join(", ").toUpperCase() || service.complaint?.toUpperCase() || "REPAIR KAMERA BELAKANG";
  const maskedCustomerPhone = formatPhoneDisplay(customer.phone);
  const maskedBranchPhone = branch.phone;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Print ${invoiceNo} — Dot Matrix</title>
<style>
  @page { size: 9.5in 11in; margin: 6mm 8mm; }
  *{box-sizing:border-box;}
  body{ font-family: "Courier New", Courier, monospace; font-size: 11px; line-height:1.3; color:#000; width:80ch; max-width:80ch; margin:0 auto; -webkit-print-color-adjust: exact; }
  .dashed{ border:none; border-top:1px dashed #000; margin:6px 0; }
  .double{ border:none; border-top:3px double #000; margin:8px 0; }
  .header-stack{ display:grid; grid-template-columns: 18ch 1fr; gap:0 8px; font-size:11px; }
  .header-stack dt{ text-align:left; }
  .header-stack dd{ margin:0; word-break:break-all; }
  .meta-2col{ display:flex; justify-content:space-between; font-size:11px; }
  .items{ width:100%; border-collapse:collapse; font-size:11px; }
  .items th{ text-align:left; font-weight:700; border-bottom:1px dashed #000; padding:4px 6px; }
  .items td{ padding:4px 6px; vertical-align:top; }
  .items td:last-child, .items th:last-child{ text-align:right; font-variant-numeric: tabular-nums; }
  .totals{ text-align:right; line-height:1.6; }
  .notes{ font-size:10.5px; padding-left:1.5em; }
  .notes li{ margin:2px 0; }
  .sign{ display:flex; justify-content:space-between; margin-top:18px; text-align:center; font-size:11px; }
  .sign div{ width:36ch; }
  @media print{ body{margin:0;} }
</style>
</head><body><div class="page">
  <dl class="header-stack">
    <dt>Toko :</dt><dd>${branch.name}</dd>
    <dt>Alamat :</dt><dd>${branch.address}</dd>
    <dt>Website :</dt><dd>${branch.website}</dd>
    <dt>Invoice :</dt><dd>${invoiceNo}</dd>
    <dt>Teknisi :</dt><dd>${teknisi}</dd>
    <dt>Deskripsi :</dt><dd>${service.deskripsi}</dd>
    <dt>Tanggal terima :</dt><dd>${service.tanggalTerima}</dd>
  </dl>
  <div style="text-align:center; font-size:11px; margin:6px 0;">Cek Service &nbsp;&nbsp; Cek Garansi</div>
  <hr class="dashed">
  <div class="meta-2col"><span>Imei 1 /SN : ${service.imei1}</span><span>Invoice : ${invoiceNo}</span></div>
  <div class="meta-2col"><span>Imei 2 /SN : ${service.imei2}</span><span>Tanggal Service : ${service.date}</span></div>
  <hr class="dashed">
  <table class="items"><thead><tr><th>Merek</th><th>Kelengkapan</th><th>Kerusakan</th><th>Harga</th></tr></thead>
  <tbody><tr><td>${(service.merk || service.device.split(" ")[0]).toUpperCase()} ${service.tipe || ""}</td><td>${kelengkapanStr}</td><td>${kerusakanStr}</td><td>${formatEn(service.price)}</td></tr></tbody></table>
  <hr class="dashed">
  <div class="totals">Payment Cash<br>Total &nbsp; ${formatEn(service.price)}</div>
  <hr class="double">
  <div>Catatan :</div><ol class="notes"><li>Garansi 2 Minggu, berlaku barang sudah diambil.</li><li>Slip ini wajib dibawa ketika akan mengambil service.</li><li>Garansi berlaku pada kerusakan yang sama.</li><li>Cek kembali barang service anda saat penyerahan.</li></ol>
  <hr class="dashed">
  <div class="sign"><div>Konsumen<br>( ${customer.name} )<br>${maskedCustomerPhone}</div><div>Admin<br>( ${admin} )<br>${maskedBranchPhone}</div></div>
  <div style="text-align:center; margin-top:12px; font-size:9px; color:#666;">${printTime} · ${invoiceNo}</div>
</div><script>window.print();</script></body></html>`;
}

// Thermal - 58mm narrow receipt, centered, dashed separators
export function renderThermalHtml(data: PrintData): string {
  const { branch, invoiceNo, service, customer, admin, teknisi, printTime } = data;
  const maskedCustomerPhone = formatPhoneDisplay(customer.phone);
  const maskedBranchPhone = branch.phone;
  const kerusaanStr = (service.kerusakan || []).join(", ").toUpperCase() || service.complaint?.toUpperCase() || "REPAIR KAMERA BELAKANG";

  return `<!doctype html><html><head><meta charset="utf-8"><title>Print ${invoiceNo} — Thermal</title>
<style>
  @page { size: 58mm auto; margin: 0; }
  *{box-sizing:border-box;}
  body{ font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height:1.35; width:58mm; max-width:58mm; margin:0 auto; padding:3mm 2mm; color:#000; -webkit-print-color-adjust: exact; }
  .center{ text-align:center; }
  .bold{ font-weight:700; }
  .sep{ border:none; border-top:1px dashed #000; margin:6px 0; }
  .field{ margin:2px 0; }
  .field .label{ display:block; font-size:10px; text-transform:uppercase; letter-spacing:.04em; }
  .field .value{ display:block; font-weight:600; word-break:break-word; }
  .row{ display:flex; justify-content:space-between; gap:4px; }
  @media print{ body{width:58mm; margin:0;} }
</style>
</head><body>
  <div class="center bold" style="font-size:13px;">${branch.name}</div>
  <div class="center" style="font-size:9px; word-break:break-word;">${branch.address}</div>
  <div class="center" style="font-size:8px; word-break:break-all;">${branch.website}</div>
  <div class="center">${maskedBranchPhone}</div>
  <hr class="sep">
  <div class="field"><span class="label">Admin</span><span class="value">${admin}</span></div>
  <div class="field"><span class="label">Teknisi</span><span class="value">${teknisi}</span></div>
  <div class="field"><span class="label">Tanggal Service</span><span class="value">${service.date}</span></div>
  <div class="field"><span class="label">Invoice</span><span class="value">${invoiceNo}</span></div>
  <div class="field"><span class="label">Tanggal terima</span><span class="value">${service.tanggalTerima}</span></div>
  <div class="field"><span class="label">Garansi sampai</span><span class="value">${service.garansiSampai}</span></div>
  <hr class="sep">
  <div class="field"><span class="label">Konsumen</span><span class="value">${customer.name}</span></div>
  <div class="field"><span class="label">Telepon</span><span class="value">${maskedCustomerPhone}</span></div>
  <div class="field"><span class="label">Merek</span><span class="value">${service.merk || service.device.split(" ")[0]} ${service.tipe || ""}</span></div>
  <div class="field"><span class="label">Imei 1 /SN</span><span class="value">${service.imei1}</span></div>
  <div class="field"><span class="label">Imei 2 /SN</span><span class="value">${service.imei2}</span></div>
  <div class="field"><span class="label">Kelengkapan</span><span class="value">${(service.kelengkapan || []).join(", ") || "SIMTRAY"}</span></div>
  <div class="field"><span class="label">Deskripsi</span><span class="value">${service.deskripsi}</span></div>
  <hr class="sep">
  <div class="center bold">###COPY###</div>
  <hr class="sep">
  <div class="row bold"><span>${kerusaanStr}</span><span>${formatEn(service.price)}</span></div>
  <hr class="sep">
  <div class="row"><span>Payment</span><span>Cash</span></div>
  <div class="row bold"><span>Total</span><span>${formatEn(service.price)}</span></div>
  <hr class="sep">
  <div class="center bold">###CEK SERVICE DAN GARANSI###</div>
  <hr class="sep">
  <div class="row center" style="justify-content:center; gap:16px;"><span>Service</span><span>Cek Garansi</span></div>
  <hr class="sep">
  <div class="center" style="font-size:8px; color:#666; margin-top:8px;">${printTime} · ${invoiceNo}</div>
</div><script>window.print();</script></body></html>`;
}
