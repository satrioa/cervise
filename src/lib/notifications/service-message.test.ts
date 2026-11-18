import { describe, expect, it } from "vitest";
import {
  buildCustomerCreatedMessage,
  buildCustomerInvoiceParameters,
  buildCustomerStatusMessage,
  buildCustomerStatusParameters,
  buildTechnicianCreatedMessage,
  buildTechnicianJobParameters,
  publicLacakUrl,
  type ServiceMessageInput,
} from "./service-message";

const base: ServiceMessageInput = {
  storeName: "Servisin",
  tenantSlug: "servisin",
  serviceId: "3f1c2b44-0000-4000-8000-000000000001",
  serviceNumber: "SRV-2026-0012",
  device: "Xiaomi Redmi 13C",
  complaint: "Layar pecah, Baterai drop",
  trackingCode: "F5FB0DFCB6",
  status: "Masuk",
  siteOrigin: "https://app.kaggo.id",
  priceEstimasi: null,
  garansiValue: null,
  garansiUnit: null,
};

const builders = [
  buildCustomerCreatedMessage,
  buildCustomerStatusMessage,
  buildTechnicianCreatedMessage,
];

/** Setiap baris harus utuh: tidak kosong, tidak menggantung, tidak berawal pemisah. */
function expectCleanLines(message: string): void {
  expect(message.trim()).not.toBe("");
  for (const line of message.split("\n")) {
    expect(line).not.toBe("");
    expect(line.trim()).toBe(line);
    expect(line.endsWith(":")).toBe(false);
    expect(line.startsWith("- ")).toBe(false);
  }
}

describe("publicLacakUrl", () => {
  it("menyusun tautan halaman lacak tanpa garis miring ganda", () => {
    expect(publicLacakUrl("https://app.kaggo.id", "servisin", "F5FB0DFCB6")).toBe(
      "https://app.kaggo.id/servisin/lacak/F5FB0DFCB6",
    );
  });

  it("mengembalikan string kosong kalau ada bagian yang tidak ada", () => {
    expect(publicLacakUrl("https://app.kaggo.id", "servisin", null)).toBe("");
    expect(publicLacakUrl("https://app.kaggo.id", null, "F5FB0DFCB6")).toBe("");
  });

  it("tetap benar kalau origin berakhir dengan garis miring", () => {
    // Tanpa kasus ini, penyusunan tautan polos dengan interpolasi string
    // lolos semua test sambil menghasilkan `//`.
    expect(publicLacakUrl("https://app.kaggo.id/", "servisin", "F5FB0DFCB6")).toBe(
      "https://app.kaggo.id/servisin/lacak/F5FB0DFCB6",
    );
    expect(publicLacakUrl("https://app.kaggo.id///", "servisin", "F5FB0DFCB6")).toBe(
      "https://app.kaggo.id/servisin/lacak/F5FB0DFCB6",
    );
  });

  it("tidak melempar saat origin belum dikonfigurasi", () => {
    // siteOrigin datang dari env di task berikutnya. Kalau env itu kosong,
    // pemanggil harus dapat string kosong, bukan TypeError di dalam worker.
    expect(publicLacakUrl(null, "servisin", "F5FB0DFCB6")).toBe("");
    expect(publicLacakUrl(undefined, "servisin", "F5FB0DFCB6")).toBe("");
  });
});

describe("struktur pesan", () => {
  const sparseFields: (keyof ServiceMessageInput)[] = [
    "serviceNumber",
    "complaint",
    "trackingCode",
    "status",
  ];

  it("tidak pernah meninggalkan label menggantung, baris kosong, atau pisah", () => {
    // Semua kombinasi field kosong, supaya tidak ada baris yang berakhir dengan
    // tanda titik dua, baris kosong, atau baris yang diawali pemisah.
    for (const field of sparseFields) {
      const message = buildCustomerStatusMessage({ ...base, [field]: null });
      const lines = message.split("\n");

      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).not.toBe("");
        expect(line.trim()).toBe(line);
        expect(line.endsWith(":")).toBe(false);
        expect(line.startsWith("- ")).toBe(false);
      }
    }
  });

  it("tetap menyebut nama toko walau field lain kosong", () => {
    const bare: ServiceMessageInput = {
      storeName: "Servisin",
      tenantSlug: null,
      serviceId: "svc-1",
      serviceNumber: null,
      device: "iPhone 13",
      complaint: null,
      trackingCode: null,
      status: null,
      siteOrigin: "",
      priceEstimasi: null,
      garansiValue: null,
      garansiUnit: null,
    };

    for (const message of [
      buildCustomerCreatedMessage(bare),
      buildCustomerStatusMessage(bare),
      buildTechnicianCreatedMessage(bare),
    ]) {
      expect(message.startsWith("Servisin")).toBe(true);
      expect(message.trim()).toBe(message);
    }
  });

  it("tidak meninggalkan pemisah menggantung saat nama toko kosong", () => {
    // Nama toko tidak pernah dikarang kalau kosong, jadi pemisah " - "-nya
    // ikut hilang. Tanpa kasus ini, heading yang asal tempel string lolos
    // semua test lalu mengirim baris yang diawali "- ".
    for (const blank of ["", "   "]) {
      for (const build of builders) {
        expectCleanLines(build({ ...base, storeName: blank }));
      }
    }
  });

  it("tidak meninggalkan tautan menggantung saat origin kosong", () => {
    // internalServisUrl tidak diekspor, jadi baris "Buka" teknisi yang
    // memegangnya. Tanpa cek ini, origin kosong menghasilkan "/app/servis/...".
    const message = buildTechnicianCreatedMessage({ ...base, siteOrigin: null });
    expect(message).not.toContain("/app/servis/");
    expect(message).not.toContain("Buka:");
    expectCleanLines(message);
  });
});

describe("pesan ke customer", () => {
  it("menyebutkan nama toko, nomor servis, dan kode cek", () => {
    const message = buildCustomerCreatedMessage(base);
    expect(message).toContain("Servisin");
    expect(message).toContain("SRV-2026-0012");
    expect(message).toContain("Xiaomi Redmi 13C");
    expect(message).toContain("F5FB0DFCB6");
    expect(message).toContain("https://app.kaggo.id/servisin/lacak/F5FB0DFCB6");
  });

  it("menyebutkan status baru saat status berubah", () => {
    const message = buildCustomerStatusMessage({ ...base, status: "Selesai" });
    expect(message).toContain("Selesai");
    expect(message).toContain("F5FB0DFCB6");
  });

  it("tidak pernah merender undefined atau kosong", () => {
    const sparse: ServiceMessageInput = {
      ...base,
      serviceNumber: null,
      complaint: null,
      trackingCode: null,
      priceEstimasi: null,
      garansiValue: null,
      garansiUnit: null,
    };
    for (const message of [
      buildCustomerCreatedMessage(sparse),
      buildCustomerStatusMessage(sparse),
      buildTechnicianCreatedMessage(sparse),
    ]) {
      expect(message).not.toContain("undefined");
      expect(message).not.toContain("null");
      expect(message).not.toContain("NaN");
    }
  });
});

describe("pesan ke teknisi", () => {
  it("menyebutkan nomor servis dan tautan internal", () => {
    const message = buildTechnicianCreatedMessage(base);
    expect(message).toContain("Servisin");
    expect(message).toContain("SRV-2026-0012");
    expect(message).toContain("Layar pecah, Baterai drop");
    expect(message).toContain("https://app.kaggo.id/app/servis/3f1c2b44-0000-4000-8000-000000000001");
  });
});

describe("parameter template invoice customer", () => {
  it("mengisi tujuh parameter berurutan", () => {
    expect(
      buildCustomerInvoiceParameters({
        ...base,
        priceEstimasi: 150000,
        garansiValue: 3,
        garansiUnit: "bulan",
      }),
    ).toEqual([
      { type: "text", parameter_name: "store_name", value: "Servisin" },
      { type: "text", parameter_name: "service_number", value: "SRV-2026-0012" },
      { type: "text", parameter_name: "device", value: "Xiaomi Redmi 13C" },
      { type: "text", parameter_name: "complaint", value: "Layar pecah, Baterai drop" },
      { type: "text", parameter_name: "estimate", value: "Rp 150.000" },
      { type: "text", parameter_name: "warranty", value: "3 bulan" },
      {
        type: "text",
        parameter_name: "tracking_url",
        value: "https://app.kaggo.id/servisin/lacak/F5FB0DFCB6",
      },
    ]);
  });

  it("memakai fallback saat estimasi dan field lain kosong", () => {
    const params = buildCustomerInvoiceParameters({
      ...base,
      serviceNumber: null,
      complaint: null,
      trackingCode: null,
      siteOrigin: null,
      priceEstimasi: null,
    });
    expect(params.map((p) => p.value)).toEqual([
      "Servisin",
      "Xiaomi Redmi 13C",
      "Xiaomi Redmi 13C",
      "-",
      "Menunggu pemeriksaan",
      "-",
      "-",
    ]);
    for (const param of params) expect(param.value).not.toContain("undefined");
  });

  it("tidak merender estimasi 0 sebagai Rp 0", () => {
    const params = buildCustomerInvoiceParameters({ ...base, priceEstimasi: 0 });
    expect(params[4].value).toBe("Menunggu pemeriksaan");
  });

  it("memakai fallback saat ketiga field tidak dikirim", () => {
    const params = buildCustomerInvoiceParameters({
      storeName: "Servisin",
      tenantSlug: "servisin",
      serviceId: "svc-1",
      serviceNumber: null,
      device: "Xiaomi Redmi 13C",
      complaint: null,
      trackingCode: null,
      status: null,
      siteOrigin: null,
    });
    expect(params[4].value).toBe("Menunggu pemeriksaan");
    expect(params[5].value).toBe("-");
    for (const param of params) expect(param.value).not.toContain("undefined");
  });

  it("garansi '-' kalau hanya satu dari nilai/satuan yang ada", () => {
    expect(
      buildCustomerInvoiceParameters({ ...base, garansiValue: 3, garansiUnit: null })[5].value,
    ).toBe("-");
    expect(
      buildCustomerInvoiceParameters({ ...base, garansiValue: null, garansiUnit: "bulan" })[5].value,
    ).toBe("-");
  });
});

describe("parameter template status customer", () => {
  it("memakai status yang diteruskan, bukan status hardcode", () => {
    const params = buildCustomerStatusParameters({ ...base, status: "Sudah Diambil" });
    expect(params.map((p) => p.value)).toEqual([
      "Servisin",
      "SRV-2026-0012",
      "Xiaomi Redmi 13C",
      "Sudah Diambil",
      "F5FB0DFCB6",
      "https://app.kaggo.id/servisin/lacak/F5FB0DFCB6",
    ]);
  });
});

describe("parameter template teknisi", () => {
  it("mengisi lima parameter berurutan", () => {
    expect(buildTechnicianJobParameters(base)).toEqual([
      { type: "text", parameter_name: "store_name", value: "Servisin" },
      { type: "text", parameter_name: "service_number", value: "SRV-2026-0012" },
      { type: "text", parameter_name: "device", value: "Xiaomi Redmi 13C" },
      { type: "text", parameter_name: "complaint", value: "Layar pecah, Baterai drop" },
      {
        type: "text",
        parameter_name: "service_url",
        value: "https://app.kaggo.id/app/servis/3f1c2b44-0000-4000-8000-000000000001",
      },
    ]);
  });

  it("mengganti tautan kosong dengan '-' bukan '/app/servis/' menggantung", () => {
    const params = buildTechnicianJobParameters({ ...base, siteOrigin: null });
    expect(params[4].value).toBe("-");
  });
});
