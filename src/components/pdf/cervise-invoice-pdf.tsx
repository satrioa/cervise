// @ts-nocheck
"use client";

import { Document, Page, Text, View, StyleSheet } from "@formepdf/react";

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
  };
  customer: { name: string; phone: string };
  admin: string;
  teknisi: string;
  printTime: string;
};

function formatEn(price: number): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.replace(/^0/, "62").replace(/^8/, "62");
  if (normalized.length < 10) return phone;
  const masked = normalized.replace(/(\d{3})\d{4}(\d+)/, (_, a, b) => `${a}****${b}`);
  return masked.startsWith("62") ? `+${masked}` : masked;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 24,
    paddingLeft: 24,
    paddingRight: 24,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  topBar: {
    height: 4,
    backgroundColor: "#111827",
    marginBottom: 12,
    marginLeft: -24,
    marginRight: -24,
    marginTop: -24,
  },
  headerFlex: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  branchName: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 2,
  },
  branchMeta: {
    fontSize: 7,
    color: "#6b7280",
  },
  invoiceStamp: {
    borderWidth: 2,
    borderColor: "#111827",
    borderStyle: "solid",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: "right",
    minWidth: 120,
  },
  invoiceLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    textAlign: "right",
  },
  invoiceNo: {
    fontSize: 12,
    fontWeight: 700,
    textAlign: "right",
    marginTop: 2,
  },
  rule: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#111827",
    borderBottomStyle: "solid",
    marginVertical: 8,
  },
  table: {
    borderWidth: 1,
    borderColor: "#111827",
    borderStyle: "solid",
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#111827",
    color: "#ffffff",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 6,
    fontWeight: 700,
    textTransform: "uppercase",
    textAlign: "center",
    color: "#ffffff",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    borderBottomStyle: "solid",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableCell: {
    flex: 1,
    fontSize: 7,
    textAlign: "center",
  },
  tableCellLeft: {
    textAlign: "left",
  },
  tableCellRight: {
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  infoGrid: {
    flexDirection: "row",
    marginTop: 10,
    gap: 16,
  },
  infoCol: {
    flex: 1,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  infoLabel: {
    width: 70,
    fontSize: 7,
    color: "#111827",
  },
  infoColon: {
    width: 8,
    textAlign: "center",
  },
  infoVal: {
    flex: 1,
    fontSize: 7,
  },
  bullet: {
    fontSize: 4,
    marginRight: 3,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 2,
    borderTopColor: "#111827",
    borderTopStyle: "solid",
    paddingTop: 6,
    marginTop: 8,
  },
  checks: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginVertical: 8,
  },
  checkBox: {
    borderWidth: 1,
    borderColor: "#111827",
    borderStyle: "solid",
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 6,
    letterSpacing: 0.5,
  },
  catatan: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#111827",
    borderTopStyle: "solid",
    paddingTop: 6,
  },
  catatanTitle: {
    fontSize: 7,
    fontWeight: 700,
    marginBottom: 4,
  },
  catatanItem: {
    fontSize: 6.5,
    marginLeft: 12,
    marginBottom: 1,
  },
  sigs: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  sig: {
    flex: 1,
    textAlign: "center",
  },
  sigRole: {
    fontSize: 7,
    marginBottom: 28,
  },
  sigName: {
    fontSize: 6,
    fontFamily: "Helvetica",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    borderTopStyle: "solid",
    paddingTop: 6,
    marginTop: 12,
    fontSize: 5,
    color: "#9ca3af",
  },
});

export function CerviseJetPdf({ data }: { data: PrintData }) {
  const kerusakanStr = (data.service.kerusakan || []).join(", ").toUpperCase() || data.service.complaint?.toUpperCase() || "REPAIR KAMERA BELAKANG";
  const kelengkapanStr = (data.service.kelengkapan || []).join(", ").toUpperCase() || "SIMTRAY";

  return (
    <Document title={`Invoice ${data.invoiceNo}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} />
        <View style={styles.headerFlex}>
          <View>
            <Text style={styles.branchName}>{data.branch.name}</Text>
            <Text style={styles.branchMeta}>{data.branch.address} · {data.branch.phone}</Text>
            <Text style={styles.branchMeta}>{data.branch.website}</Text>
          </View>
          <View style={styles.invoiceStamp}>
            <Text style={styles.invoiceLabel}>Invoice</Text>
            <Text style={styles.invoiceNo}>{data.invoiceNo}</Text>
            <Text style={{ fontSize: 7, color: "#6b7280", textAlign: "right" }}>{data.service.date}</Text>
          </View>
        </View>

        <View style={styles.rule} />

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderCell}>Merek</Text>
            <Text style={styles.tableHeaderCell}>Kelengkapan</Text>
            <Text style={styles.tableHeaderCell}>Imei 1</Text>
            <Text style={styles.tableHeaderCell}>Imei 2</Text>
            <Text style={{ ...styles.tableHeaderCell, flex: 1.5, textAlign: "left" }}>Kerusakan</Text>
            <Text style={styles.tableHeaderCell}>Deskripsi</Text>
            <Text style={styles.tableHeaderCell}>Sparepart</Text>
            <Text style={{ ...styles.tableHeaderCell, textAlign: "right" }}>Harga</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>{(data.service.merk || data.service.device.split(" ")[0]).toUpperCase()}</Text>
            <Text style={styles.tableCell}>{kelengkapanStr}</Text>
            <Text style={styles.tableCell}>{data.service.imei1}</Text>
            <Text style={styles.tableCell}>{data.service.imei2}</Text>
            <Text style={{ ...styles.tableCell, ...styles.tableCellLeft, flex: 1.5 }}>{kerusakanStr}</Text>
            <Text style={styles.tableCell}>{data.service.deskripsi}</Text>
            <Text style={styles.tableCell}>{data.service.sparepart}</Text>
            <Text style={{ ...styles.tableCell, ...styles.tableCellRight }}>{formatEn(data.service.price)}</Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <View style={styles.infoRow}><Text style={styles.bullet}>●</Text><Text style={styles.infoLabel}>Admin</Text><Text style={styles.infoColon}>:</Text><Text style={styles.infoVal}>{data.admin}</Text></View>
            <View style={styles.infoRow}><Text style={styles.bullet}>●</Text><Text style={styles.infoLabel}>Teknisi</Text><Text style={styles.infoColon}>:</Text><Text style={styles.infoVal}>{data.teknisi}</Text></View>
            <View style={styles.infoRow}><Text style={styles.bullet}>●</Text><Text style={styles.infoLabel}>Telepon</Text><Text style={styles.infoColon}>:</Text><Text style={styles.infoVal}>{data.branch.phone}</Text></View>
            <View style={styles.infoRow}><Text style={styles.bullet}>●</Text><Text style={styles.infoLabel}>Alamat</Text><Text style={styles.infoColon}>:</Text><Text style={styles.infoVal}>{data.branch.address}</Text></View>
            <View style={styles.infoRow}><Text style={styles.bullet}>●</Text><Text style={styles.infoLabel}>Website</Text><Text style={styles.infoColon}>:</Text><Text style={styles.infoVal}>{data.branch.website}</Text></View>
          </View>
          <View style={styles.infoCol}>
            <View style={styles.infoRow}><Text style={styles.bullet}>●</Text><Text style={styles.infoLabel}>Konsumen</Text><Text style={styles.infoColon}>:</Text><Text style={styles.infoVal}>{data.customer.name}</Text></View>
            <View style={styles.infoRow}><Text style={styles.bullet}>●</Text><Text style={styles.infoLabel}>Telepon</Text><Text style={styles.infoColon}>:</Text><Text style={styles.infoVal}>{maskPhone(data.customer.phone)}</Text></View>
            <View style={styles.infoRow}><Text style={styles.bullet}>●</Text><Text style={styles.infoLabel}>Tanggal Service</Text><Text style={styles.infoColon}>:</Text><Text style={styles.infoVal}>{data.service.date}</Text></View>
            <View style={styles.infoRow}><Text style={styles.bullet}>●</Text><Text style={styles.infoLabel}>Garansi sampai</Text><Text style={styles.infoColon}>:</Text><Text style={styles.infoVal}>{data.service.garansiSampai}</Text></View>
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={{ fontSize: 7 }}>Payment Cash</Text>
          <Text style={{ fontSize: 9, fontWeight: 700 }}>Total  {formatEn(data.service.price)}</Text>
        </View>

        <View style={styles.checks}>
          <Text style={styles.checkBox}>Cek Service</Text>
          <Text style={styles.checkBox}>Cek Garansi</Text>
        </View>

        {(data.service as any).passwordType === "POLA" && (
          <View style={{ marginTop: 6 }}>
            <Text style={{ fontSize: 7, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Pola</Text>
            <View style={{ width: 72, height: 72, borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#f9fafb", position: "relative" } as any}>
              <Text style={{ fontSize: 5, textAlign: "center", marginTop: 28 }}>Pola: {(data.service as any).passwordValue}</Text>
            </View>
          </View>
        )}

        <View style={styles.catatan}>
          <Text style={styles.catatanTitle}>Catatan :</Text>
          <Text style={styles.catatanItem}>1. Garansi service 2 Minggu, berlaku barang sudah diambil.</Text>
          <Text style={styles.catatanItem}>2. Slip ini wajib dibawa ketika akan mengambil service.</Text>
          <Text style={styles.catatanItem}>3. Garansi berlaku pada kerusakan yang sama.</Text>
          <Text style={styles.catatanItem}>4. Cek kembali barang service anda saat penyerahan.</Text>
        </View>

        <View style={styles.sigs}>
          <View style={styles.sig}><Text style={styles.sigRole}>Konsumen</Text><Text style={styles.sigName}>( {data.customer.name} )</Text></View>
          <View style={styles.sig}><Text style={styles.sigRole}>Admin</Text><Text style={styles.sigName}>( {data.admin} )</Text></View>
        </View>

        <View style={styles.footer}>
          <Text>{data.printTime} Invoice Service</Text>
          <Text>https://rbm-borneo.com/User/Service/print/jet/{data.invoiceNo}</Text>
          <Text>1/1</Text>
        </View>
      </Page>
    </Document>
  );
}
