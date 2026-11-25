import { afterEach, describe, expect, it, vi } from "vitest";
import { getWaTemplate, type WaTemplateKey } from "./wa-templates";
import {
  buildServisMasukParameters,
  buildServisStatusParameters,
  buildShiftClosedParameters,
  buildShiftOpenParameters,
  buildTechnicianParameters,
  type ShiftMessageInput,
  type ServiceMessageInput,
} from "./service-message";

const servis: ServiceMessageInput = {
  storeName: "Kaggo",
  tenantSlug: "kaggo",
  serviceId: "svc-1",
  serviceNumber: "SRV-001",
  device: "iPhone 13",
  complaint: "Layar pecah",
  trackingCode: "TRACK1",
  status: "Selesai",
  siteOrigin: "https://app.example.com",
  customerName: "Budi",
  tenantName: "Kaggo",
  branchName: "Pusat",
  technicianName: "Andi",
  priceEstimasi: 250000,
};

const shift: ShiftMessageInput = {
  tenant: "Kaggo",
  cabang: "Pusat",
  userOpen: "Sari",
  dateOpen: "18 Nov 2026",
  date: "18 Nov 2026",
  shiftOpenTime: "08:00",
  userClose: "Rina",
  shiftCloseTime: "16:00",
  saldoAwal: 100000,
  saldoAkhir: 250000,
};

const names = (params: { parameter_name: string }[]) => params.map((p) => p.parameter_name);

afterEach(() => vi.unstubAllEnvs());

describe("custom WA template registry", () => {
  it("membaca nama template dari env lama STATUS/TECHNICIAN", () => {
    vi.stubEnv("META_WA_TEMPLATE_STATUS", "status-lama-v1");
    vi.stubEnv("META_WA_TEMPLATE_TECHNICIAN", "teknisi-lama-v1");
    vi.stubEnv("META_WA_TEMPLATE_SERVIS_SIAP", "status-baru-v1");
    vi.stubEnv("META_WA_TEMPLATE_TEKNISI", "teknisi-baru-v1");

    expect(getWaTemplate("servis_status_customer").name).toBe("status-lama-v1");
    expect(getWaTemplate("servis_created_technician").name).toBe("teknisi-lama-v1");
  });

  it("bahasa per template sesuai template Meta", () => {
    const expected: Record<WaTemplateKey, "id" | "en"> = {
      servis_created_customer: "id",
      servis_status_customer: "en",
      servis_created_technician: "en",
      shift_open: "id",
      shift_closed: "id",
    };
    for (const [key, language] of Object.entries(expected)) {
      expect(getWaTemplate(key as WaTemplateKey).language).toBe(language);
    }
  });

  it("placeholder servis masuk sesuai servis_masuk_v2", () => {
    expect(names(buildServisMasukParameters(servis))).toEqual([
      "customer", "device", "nomor_servis", "complaint", "estimated", "tenant", "cabang",
    ]);
  });

  it("placeholder status sesuai servis_status_customer_v1 (2 param body)", () => {
    expect(names(buildServisStatusParameters(servis))).toEqual([
      "device", "service_number",
    ]);
  });

  it("placeholder teknisi sesuai servis_baru_teknisi_v1 (nama di header)", () => {
    expect(names(buildTechnicianParameters(servis))).toEqual([
      "nama_teknisi", "device", "complaint", "service_number",
    ]);
  });

  it("placeholder shift open dan close sesuai template Meta", () => {
    expect(names(buildShiftOpenParameters(shift))).toEqual([
      "tenant", "cabang", "user_open", "date_open", "saldo_awal",
    ]);
    expect(names(buildShiftClosedParameters(shift))).toEqual([
      "tenant", "cabang", "tanggal", "user_buka", "jam_buka",
      "user_tutup", "jam_tutup", "saldo_awal", "servis", "penjualan",
      "kas_manual", "kas_diharapkan", "saldo_akhir", "selisih",
    ]);
  });

  it("nilai kosong jadi dash, bukan string kosong", () => {
    const params = buildServisStatusParameters({ ...servis, customerName: null, device: "" });
    for (const param of params) expect(param.value).not.toBe("");
  });
});
