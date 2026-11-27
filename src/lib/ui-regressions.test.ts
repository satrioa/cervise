import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("regresi UI", () => {
  it("Usage menampilkan nama cabang, bukan potongan id", () => {
    const source = read("src/app/app/pengaturan/usage/pengaturan-usage-client.tsx");
    expect(source).not.toContain("branch.slice(0, 8)");
    expect(source).toContain('branches.find((b) => b.id === branch)?.name');
  });

  it("cabang menghitung hanya teknisi", () => {
    const source = read("src/app/app/cabang/actions.ts");
    expect(source).toContain('select("branch_id, role")');
    expect(source).toContain('normalizeAppRole(e.role) !== "TECHNICIAN"');
  });

  it("Lewati sparepart memakai action status, bukan RPC dengan items kosong", () => {
    const source = read("src/components/servis/sparepart-dialogs.tsx");
    expect(source).toContain("updateServisStatus(servis.id, \"Dikerjakan\")");
    expect(source).not.toContain("useSparepartsForServis(servis.id, [])");
  });

  it("saldo awal ditunda sampai password sementara diganti", () => {
    const shell = read("src/components/layout/compact-shell.tsx");
    const layout = read("src/app/app/layout.tsx");
    expect(shell).toContain('role === "FRONTLINER" && !actor.mustChangePassword');
    expect(layout).toContain("mustChangePassword: Boolean(actor.mustChangePassword)");
  });

  it("PIN device dan garansi opsional saat tambah servis", () => {
    const form = read("src/components/servis/servis-form.tsx");
    expect(form).toContain("Password Device (opsional)");
    expect(form).toContain("Garansi (opsional)");
    expect(form).not.toContain('return "Garansi wajib diisi (>0)"');
    const action = read("src/app/app/servis/actions.ts");
    expect(action).not.toContain('throw new Error("Password device wajib")');
    expect(action).not.toContain('throw new Error("Garansi wajib")');
  });

  it("halaman notifikasi WA tersedia di navigasi platform owner", () => {
    const nav = read("src/components/owner/owner-navigation.tsx");
    expect(nav).toContain('href: "/owner/notifications"');
    expect(nav).toContain("Notifikasi WA");
    const page = read("src/app/owner/notifications/page.tsx");
    expect(page).toContain("requirePlatformAdmin()");
    expect(page).toContain("createAdminClient()");
    expect(page).toContain("cervise_notification_outbox");
  });

  it("aksi kas, penjualan, dan tenant tidak revalidate saat dipanggil dari transisi klien", () => {
    for (const file of [
      "src/app/app/actions/cash.ts",
      "src/app/app/penjualan/actions.ts",
      "src/app/dashboard/tenant/actions.ts",
    ]) {
      expect(read(file), file).not.toContain("revalidatePath");
    }
    expect(read("src/components/servis/servis-form.tsx")).not.toContain("router.refresh()");
  });

  it("action servis tidak revalidate saat dipanggil dari client transition", () => {
    const source = read("src/app/app/servis/sparepart-actions.ts");
    expect(source).not.toContain("revalidatePath");
  });

  it("tabel servis memakai status ringkas dan sort tanggal masuk", () => {
    const page = read("src/app/app/servis/page.tsx");
    expect(page).not.toContain("PickedUpBadge");
    expect(page.match(/<ServisStatus stage=\{r\.status\}/g) ?? []).toHaveLength(2);
    expect(page).toContain("Terakhir update {formatWibStamp(updatedAt)}");
    expect(page).toContain("formatWibStamp(r.createdAt ?? r.date)");
    expect(page).toContain('aria-label="Urutkan tanggal masuk"');
    expect(page).toContain("const [dateSort,");
  });

  it("swipe action meneruskan onClick agar tap kartu membuka sheet", () => {
    const source = read("src/components/arc/swipe-actions/swipe-actions.tsx");
    expect(source).toContain("onClick?: (event: ReactMouseEvent<HTMLDivElement>) => void");
    expect(source).toContain("onClickCapture={onClickCapture} onClick={onClick}");
  });

  it("order action tidak revalidate saat dipanggil dari client transition", () => {
    const usage = read("src/app/app/pengaturan/usage/actions.ts");
    const subscription = read("src/app/app/pengaturan/subscription/actions.ts");
    const createOrder = usage.slice(
      usage.indexOf("export async function createTopupOrderAction"),
      usage.indexOf("export async function createCheckoutAction"),
    );
    const requestPackage = subscription.slice(
      subscription.indexOf("export async function requestPackage"),
    );
    expect(createOrder).not.toContain("revalidatePath");
    expect(requestPackage).not.toContain("revalidatePath");
  });

  it("bar bawah kartu KPI menempel di tepi bawah kartu", () => {
    const source = read("src/components/kokonutui/metric-card.tsx");
    expect(source).toContain('"flex h-full w-full max-w-md flex-col select-none');
    expect(source).toContain('className="mt-auto border-zinc-100 border-t pt-4');
  });

  it("semua link internal di shell dipaksa navigasi penuh (tidak memicu removeChild SPA)", () => {
    for (const file of [
      "src/components/layout/compact-shell.tsx",
      "src/components/layout/app-shell.tsx",
    ]) {
      const source = read(file);
      expect(source, file).toContain('document.addEventListener("click", handler, true)');
      expect(source, file).toContain("window.location.assign(href)");
    }
    expect(read("src/components/layout/command-palette.tsx")).toContain(
      "window.location.assign(href)",
    );
  });
});
