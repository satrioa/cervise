import { requireMenuForBilling } from "@/lib/auth/require-menu";
import { SettingsBillingShowcasePage } from "@/components/settings-billing";
import { PageHeader } from "@/components/layout/page-header";

/**
 * Alasan tenant sampai ke halaman ini, dibaca dari `?reason=`.
 *
 * Tanpa banner ini, orang yang trial-nya baru habis berakhir melihat halaman
 * tagihan dengan tampilan yang sama seperti saat masih aktif - tidak ada
 * penjelasan kenapa-feature di aplikasi lain suddenly tidak bisa dibuka.
 * Kodenya sama dengan nilai yang ditulis `getTenantAccessRedirect()`.
 */
const ACCESS_REASON_TEXT: Record<string, { title: string; body: string }> = {
  "trial-ended": {
    title: "Masa trial Anda sudah berakhir",
    body: "Aplikasi lain sudah tidak bisa dibuka. Pilih paket di bawah untuk melanjutkan - invoice dibuat begitu tombol ditekan, dan paket aktif setelah platform owner memverifikasi pembayaran Anda.",
  },
  blocked: {
    title: "Langganan Anda sedang tidak aktif",
    body: "Akses ke data toko ditangguhkan karena langganan belum aktif. Pilih paket di bawah atau hubungi platform owner bila ini tidak sesuai.",
  },
};

export default async function SubscriptionPage({
  searchParams,
}: {
  // Promise, bukan objek: di Next.js 16 `searchParams` sudah async.
  searchParams: Promise<{ reason?: string }>;
}) {
  // Paket, harga, dan masa langganan milik pemilik tenant.
  //
  // Guard memakai `requireMenuForBilling`, bukan `requireMenu`: tenant yang
  // trial-nya sudah habis tidak boleh dikunci dari halaman yang justru
  // dipakai untuk membayar. `AppLayout` sudah mengecualikan path ini dari
  // gate langganan; guard di sini tetap wajib agar role tanpa hak
  // `pengaturan_subscription` tidak bisa melihat harga paket.
  await requireMenuForBilling("pengaturan_subscription");

  const { reason } = await searchParams;
  const notice = reason ? ACCESS_REASON_TEXT[reason] : undefined;

  return (
    <div className="min-h-svh bg-background">
      <PageHeader
        title="Subscription"
        titleClassName="font-heading text-2xl"
        description="Harga dalam Rp — mengikuti pengaturan Lokalisasi (IDR). Untuk USD, ubah Currency di Lokalisasi."
        containerClassName="max-w-4xl"
      />
      <div className="mx-auto max-w-4xl px-6 py-8">
        {notice ? (
          <div
            role="status"
            className="mb-6 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3"
          >
            <p className="text-sm font-semibold text-warning-foreground">{notice.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{notice.body}</p>
          </div>
        ) : null}
        <SettingsBillingShowcasePage />
      </div>
    </div>
  );
}
