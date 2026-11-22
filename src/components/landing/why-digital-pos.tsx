import { MapPinIcon, PackageIcon, WalletIcon, WrenchIcon } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PAIN_POINTS = [
  {
    icon: WrenchIcon,
    title: "Servis & antrean tidak tercatat",
    description:
      "Riwayat servis, status pengerjaan, dan garansi tercatat otomatis tanpa buku catatan.",
  },
  {
    icon: WalletIcon,
    title: "Laporan kas menyita waktu",
    description:
      "Rekap kas dan omzet otomatis. Tutup shift tanpa harus menghitung manual tiap malam.",
  },
  {
    icon: PackageIcon,
    title: "Stok sparepart tidak terkontrol",
    description:
      "Barang masuk dan keluar tercatat, jadi tidak kehabisan mendadak saat toko ramai.",
  },
  {
    icon: MapPinIcon,
    title: "Susah pantau cabang & teknisi",
    description:
      "Semua cabang dan kinerja teknisi bisa dipantau dari HP, kapan saja dan di mana saja.",
  },
];

export function WhyDigitalPos() {
  return (
    <section className="border-t bg-muted/20 px-4 py-16 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="mx-auto text-center font-heading text-balance text-2xl font-medium md:text-3xl lg:text-4xl">
          Kenapa kamu butuh aplikasi digital?
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground md:text-base">
          Pencatatan manual sering jadi penghambat pertumbuhan. Empat masalah ini yang paling
          sering dialami pemilik toko servis — dan bisa diselesaikan dengan satu sistem.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PAIN_POINTS.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="h-full">
              <CardHeader>
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
