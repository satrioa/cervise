import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * FAQ landing page. Accordion sengaja tanpa `multiple`: satu pertanyaan
 * terbuka pada satu waktu supaya bagian ini tetap ringkas di mobile.
 */
export function FaqSection() {
  return (
    <section id="faq" className="border-t bg-background px-4 py-16 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
            FAQ
          </div>
          <h2 className="mt-2 font-heading text-3xl tracking-tight md:text-4xl">
            Pertanyaan yang sering diajukan
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Hal-hal yang biasanya ditanya sebelum mulai pakai Kaggo.
          </p>
        </div>

        <Accordion defaultValue={["faq-1"]} className="mt-10">
          <AccordionItem value="faq-1">
            <AccordionTrigger>Apakah bisa mencoba gratis dulu?</AccordionTrigger>
            <AccordionPanel className="pb-4">
              Bisa. Setiap tenant baru mendapat masa trial 5 hari tanpa perlu kartu kredit.
              Selama trial semua fitur utama bisa dipakai, dan Anda bisa upgrade kapan saja.
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem value="faq-2">
            <AccordionTrigger>Apakah Kaggo bisa dipakai di ponsel?</AccordionTrigger>
            <AccordionPanel className="pb-4">
              Ya. Kaggo dirancang ringan untuk dipakai sehari-hari di HP, baik oleh frontliner
              yang menerima servis maupun teknisi yang mengerjakan perangkat.
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem value="faq-3">
            <AccordionTrigger>Bagaimana notifikasi WhatsApp bekerja?</AccordionTrigger>
            <AccordionPanel className="pb-4">
              Notifikasi dikirim otomatis saat servis masuk dan ketika unit siap diambil.
              Pesan memakai template yang sudah disetujui Meta, dengan nomor WhatsApp yang
              terhubung ke tenant Anda.
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem value="faq-4">
            <AccordionTrigger>Bisakah mengelola beberapa cabang?</AccordionTrigger>
            <AccordionPanel className="pb-4">
              Bisa. Jumlah cabang dan karyawan menyesuaikan paket yang dipilih. Anda bisa
              berpindah cabang dari header aplikasi tanpa keluar akun.
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem value="faq-5">
            <AccordionTrigger>Apakah pelanggan bisa mengecek status servis sendiri?</AccordionTrigger>
            <AccordionPanel className="pb-4">
              Ya. Lewat Portal Lacak Servis, pelanggan cukup memasukkan kode lacak yang diberikan
              saat servis dibuat untuk melihat status terkini.
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem value="faq-6">
            <AccordionTrigger>Bagaimana kalau butuh kapasitas lebih?</AccordionTrigger>
            <AccordionPanel className="pb-4">
              Gunakan skema Pay as You Grow. Atur jumlah cabang, karyawan, dan tiket servis di
              kalkulator, lalu konsultasikan penawaran custom ke tim Kaggo.
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
  );
}
