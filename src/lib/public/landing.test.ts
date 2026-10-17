import { describe, expect, it } from "vitest";
import { pickLandingBranch, toPublicTenant, type LandingRow } from "./landing";

const BASE = "https://proj.supabase.co";
const LOGO_PATH = "tenant-logos/org-1/abcdef0123456789abcdef01.png";
const BANNER_PATH = "tenant-logos/org-1/fedcba9876543210fedcba98.png";

function row(overrides: Partial<LandingRow> = {}): LandingRow {
  return {
    name: "JCellular",
    slug: "jcellular",
    logo_url: LOGO_PATH,
    banner_url: BANNER_PATH,
    tagline: "Servis Gadget Ter-murah Se-Indonesia",
    instagram_url: "https://instagram.com/jcellular.id",
    tiktok_url: "https://tiktok.com/@jcellular",
    lacak_appearance: { mode: "dark", palette: "indigo" },
    branches: [],
    lacak_testimonials: [],
    ...overrides,
  };
}

function testimonial(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    nama: "Budi",
    isi: "Servis cepat.",
    rating: 5,
    urutan: 0,
    is_active: true,
    created_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("pickLandingBranch", () => {
  it("mengambil cabang aktif paling lama dibuat", () => {
    const pilihan = pickLandingBranch([
      { id: "b", name: "B", is_active: true, created_at: "2026-02-01T00:00:00Z" },
      { id: "a", name: "A", is_active: true, created_at: "2026-01-01T00:00:00Z" },
    ]);
    expect(pilihan?.id).toBe("a");
  });

  it("melewati cabang nonaktif meski.created_at paling awal", () => {
    const pilihan = pickLandingBranch([
      { id: "nonaktif", name: "X", is_active: false, created_at: "2026-01-01T00:00:00Z" },
      { id: "aktif", name: "Y", is_active: true, created_at: "2026-05-01T00:00:00Z" },
    ]);
    expect(pilihan?.id).toBe("aktif");
  });

  it("tidak bergantung pada urutan baris dari database", () => {
    const cabang = [
      { id: "a", name: "A", is_active: true, created_at: "2026-01-01T00:00:00Z" },
      { id: "b", name: "B", is_active: true, created_at: "2026-02-01T00:00:00Z" },
    ];
    expect(pickLandingBranch(cabang)?.id).toBe(pickLandingBranch([...cabang].reverse())?.id);
  });

  it("menganggap cabang tanpa is_active sebagai aktif", () => {
    expect(pickLandingBranch([{ id: "a", name: "A" }])?.id).toBe("a");
  });

  it("mengembalikan null saat tidak ada cabang sama sekali", () => {
    expect(pickLandingBranch([])).toBeNull();
    expect(pickLandingBranch(null)).toBeNull();
    expect(pickLandingBranch(undefined)).toBeNull();
  });

  it("mengembalikan null saat semua cabang nonaktif", () => {
    expect(pickLandingBranch([{ id: "a", name: "A", is_active: false }])).toBeNull();
  });
});

describe("toPublicTenant", () => {
  it("mengubah path logo menjadi URL publik", () => {
    expect(toPublicTenant(row(), BASE).logoUrl).toBe(
      `${BASE}/storage/v1/object/public/cervise-photos/${LOGO_PATH}`,
    );
  });

  it("mengubah path banner menjadi URL publik", () => {
    expect(toPublicTenant(row(), BASE).bannerUrl).toBe(
      `${BASE}/storage/v1/object/public/cervise-photos/${BANNER_PATH}`,
    );
  });

  it("memberi logo dan banner null saat path-nya kosong atau bukan path bucket", () => {
    const hasil = toPublicTenant(row({ logo_url: "", banner_url: "bukan/path.png" }), BASE);
    expect(hasil.logoUrl).toBeNull();
    expect(hasil.bannerUrl).toBeNull();
  });

  it("tidak pernah mengambil logo dari branches.logo_url", () => {
    // branches.logo_url tidak pernah ditulis kode mana pun. Kalau nilainya
    // dipakai, logo yang tampil bukan milik tenant.
    const hasil = toPublicTenant(
      row({ branches: [{ id: "b", name: "B" } as never], logo_url: null }),
      BASE,
    );
    expect(hasil.logoUrl).toBeNull();
  });

  it("memakai storageBase kosong tanpa melempar error", () => {
    expect(toPublicTenant(row(), "").logoUrl).toBeNull();
  });

  it("membuang URL sosial yang tidak aman", () => {
    const hasil = toPublicTenant(
      row({ instagram_url: "javascript:alert(1)", tiktok_url: "https://tiktok.com/@x" }),
      BASE,
    );
    expect(hasil.instagramUrl).toBeNull();
    expect(hasil.tiktokUrl).toBe("https://tiktok.com/@x");
  });

  it("memakai branches.city sebagai alamat karena isinya alamat jalan", () => {
    const hasil = toPublicTenant(
      row({ branches: [{ id: "b", name: "Pusat", city: "Jl Pierbuan Ruko 3D", phone: "0812", is_active: true, created_at: "2026-01-01T00:00:00Z" }] }),
      BASE,
    );
    expect(hasil.branchAddress).toBe("Jl Pierbuan Ruko 3D");
    expect(hasil.branchPhone).toBe("0812");
    expect(hasil.branchName).toBe("Pusat");
  });

  it("membuang alamat dan telepon yang hanya spasi", () => {
    const hasil = toPublicTenant(
      row({ branches: [{ id: "b", name: "Pusat", city: "   ", phone: "" }] }),
      BASE,
    );
    expect(hasil.branchAddress).toBeNull();
    expect(hasil.branchPhone).toBeNull();
  });

  it("membawa testimoni aktif yang sudah ternormalisasi", () => {
    const hasil = toPublicTenant(
      row({ lacak_testimonials: [testimonial({ id: "a" }), testimonial({ id: "b", rating: 99 })] as never }),
      BASE,
    );
    expect(hasil.testimonials.map((t) => t.id)).toEqual(["a", "b"]);
    expect(hasil.testimonials[1].rating).toBeNull();
  });

  it("mengembalikan testimoni kosong saat tenant belum punya satu pun", () => {
    expect(toPublicTenant(row({ lacak_testimonials: null }), BASE).testimonials).toEqual([]);
  });

  it("memotong tagline kosong menjadi null", () => {
    expect(toPublicTenant(row({ tagline: "   " }), BASE).tagline).toBeNull();
  });
});