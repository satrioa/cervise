import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CANDY_BUTTON_TONES } from "@/components/ui/candy-button";
import { CANDY_CARD_COLOR } from "./bento-card";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

/**
 * Komentar dibuang sebelum diperiksa. Komentar candy-button memang menyebut
 * hex lama itu sebagai penjelasan apa yang diganti, jadi tanpa filter ini
 * test akan gagal karena dokumentasinya, bukan karena kodenya.
 */
const readCode = (relative: string) =>
  read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !(/(?<!:)\/\//.test(line) || line.trimStart().startsWith("//")))
    .join("\n");

const frontliner = read("src/components/dashboard/frontliner-dashboard.tsx");
const technician = read("src/components/dashboard/technician-dashboard.tsx");
/** Versi tanpa komentar, untuk assertion yang menyoroti nama kelas. */
const frontlinerCode = readCode("src/components/dashboard/frontliner-dashboard.tsx");
const technicianCode = readCode("src/components/dashboard/technician-dashboard.tsx");
const taskNoteCard = read("src/components/dashboard/task-note-card.tsx");
const bentoCard = readCode("src/components/dashboard/bento-card.tsx");
const globalsCss = read("src/app/globals.css");
const smoothButton = read("src/components/smoothui/smooth-button/index.tsx");
/** PearlButton pernah dicoba lalu dibuang; filenya tidak boleh kembali. */
const pearlButtonExists = existsSync(join(process.cwd(), "src/components/ui/pearl-button.tsx"));
const manifest = read("src/lib/nav/manifest.ts");
const candyButton = readCode("src/components/ui/candy-button.tsx");

/**
 * Dua widget candy yang berbeda, dan tugasnya dipisah:
 *
 * - CandyShortcut pernah dipakai untuk GRID PINTASAN. Sekarang grid itu sudah
 *   diganti BentoCard (delapan sel bento), jadi widget ini tidak lagi dirender
 *   di dashboard mana pun. Komponennya sengaja belum dihapus.
 * - CandyButton untuk TOMBOL BIASA satu aksi. Gradien, satu warna, tanpa
 *   chevron. Registry VengeanceUI menyebutnya "Candy Button" dan usage-nya
 *   sesederhana <CandyButton>Candy Button</CandyButton>.
 *
 * Yang dijaga test di bawah: CandyButton tidak boleh bocor ke grid bento, dan
 * "Servis baru" di grid bento tetap boleh memakai gaya candy.
 */
describe("CandyButton untuk aksi tunggal", () => {
  it(`hanya untuk "Tutup Toko", bukan kartu bento`, () => {
    // Kartu bento memakai permukaan candy SmoothUI langsung. CandyButton
    // tetap khusus tombol aksi tunggal di header.
    expect(frontliner).toMatch(/<CandyButton[\s\S]*?Tutup Toko/);
    expect(technician).not.toMatch(/CandyButton/);
    // Tidak ada tombol SmoothUI utuh di dalam kartu aksi - itu yang bikin
    // kartu jadi dua permukaan yang saling bersaing.
    expect(bentoCard).not.toMatch(/<SmoothButton/);
  });

  it("memakai usage sederhana seperti di registry", () => {
    // children langsung jadi isi tombol; tidak ada mode widget yang
    // mengharuskan props khusus.
    expect(candyButton).toMatch(/children = "Candy Button"/);
  });

  it("dipakai untuk aksi nyata di dashboard frontliner", () => {
    expect(frontliner).toMatch(/<CandyButton[\s\S]*?Tutup Toko[\s\S]*?<\/CandyButton>/);
  });

  it("nada cukup untuk empat kolom dan tidak ada yang kembar", () => {
    expect(CANDY_BUTTON_TONES.length).toBeGreaterThanOrEqual(4);
    expect(new Set(CANDY_BUTTON_TONES).size).toBe(CANDY_BUTTON_TONES.length);
  });
});

describe("warna CandyButton disesuaikan, bukan hex mentah dari registry", () => {
  it("tidak ada warna hex biru hardcoded milik registry", () => {
    // Kode aslinya memakai bg gradien biru dan shadow biru; sekarang warnanya
    // datang dari CANDY_BUTTON_TONES dan token primary.
    expect(candyButton).not.toMatch(/#54A1FD|#005FD6|#209BFF|#1187FF/);
    expect(candyButton).toMatch(/CANDY_BUTTON_TONES|var\(--color-primary\)/);
  });

  it("setiap nada punya latar DAN warna teks, supaya terbaca di light dan dark", () => {
    for (const tone of CANDY_BUTTON_TONES) {
      const entry = candyButton.split(`"${tone}"`)[1] ?? "";
      expect(entry).toMatch(/text-/);
    }
  });

  it("punya focus-visible supaya bisa dijangkau keyboard", () => {
    expect(candyButton).toMatch(/focus-visible:outline/);
  });
});

describe("catatan tugas dipakai bersama oleh kedua dashboard", () => {
  it("keduanya memakai TaskNoteCard yang sama, bukan dua salinan", () => {
    expect(technician).toMatch(/TaskNoteCard/);
    expect(frontliner).toMatch(/TaskNoteCard/);
    expect(technician).not.toMatch(/function TodoCard/);
    expect(frontliner).not.toMatch(/function TodoCard/);
  });
});

describe("grid bento delapan sel", () => {
  it("kedua dashboard memakai BentoCard untuk grid utama", () => {
    expect(technician).toMatch(/BentoCard/);
    expect(frontliner).toMatch(/BentoCard/);
    // CandyShortcut sudah tidak dirender di dashboard mana pun. Yang tersisa
    // hanya file komponennya sendiri.
    expect(technician).not.toMatch(/from "\.\/candy-shortcut"/);
    expect(frontliner).not.toMatch(/from "\.\/candy-shortcut"/);
  });

  it("teknisi: tujuh sel sesuai konsep Figma", () => {
    const cells = (technician.match(/<BentoCard/g) ?? []).length;
    // Kelas gridnya tinggal di satu tempat (`BENTO_GRID_CLASS`), jadi kedua
    // dashboard hanya mengimpor, bukan menyalin.
    expect(technician).toMatch(/BENTO_GRID_CLASS/);
    // Tidak semua sel ditulis eksplisit: StatTile dan friends ikut memakai
    // BentoCard, jadi hitungan di bawah hanya untuk sel yang langsung tertulis.
    expect(cells).toBeGreaterThanOrEqual(5);
    // Kartu aksi memakai permukaan candy, bukan kartu abu-abu yang memuat
    // tombol di dalam.
    expect(technician).toMatch(/candy="accent"/);
    expect(technician).not.toMatch(/BentoAction/);
    expect(frontliner).not.toMatch(/BentoAction/);
    // To-Do 2x2, Servis terbaru 2 baris, Target saya 2 kolom.
    expect(technician).toMatch(/span=\{2\}\s+rowSpan=\{2\}/);
    expect(technician).toMatch(/rowSpan=\{2\}/);
  });

  it("frontliner: delapan sel, tiga sel aksi berwarna", () => {
    const cells = (frontliner.match(/<BentoCard/g) ?? []).length;
    expect(frontliner).toMatch(/BENTO_GRID_CLASS/);
    expect(cells).toBeGreaterThanOrEqual(6);
    // Tiga sel aksi: Servis baru, Catat Kas, Penjualan.
    expect(frontliner).not.toMatch(/action="sand"|action="yellow"|action="green"/);
    // Ringkasan Servis satu kolom, tepat di sebelah kanan Penjualan.
    expect(frontliner).toMatch(/RingkasanServis/);
    // Ringkasan Hari ini membentang tiga baris, Servis terbaru dua baris.
    expect(frontliner).toMatch(/rowSpan=\{3\}/);
    expect(frontliner).toMatch(/rowSpan=\{2\}/);
  });

  it("Ringkasan Hari ini dibangun dari ShiftReport, bukan query terpisah", () => {
    // Semua baris di kartu ini sudah ada di `getShiftPreview`, jadi tidak
    // ada fetch tambahan untuk kartu kas.
    expect(frontliner).toMatch(/getShiftPreview/);
    expect(frontliner).toMatch(/RingkasanHariIni/);
    for (const label of [
      "Saldo Awal",
      "Omzet servis",
      "Omzet Penjualan",
      "Transaksi Manual",
      "Harus ada di laci",
    ]) {
      expect(frontliner).toContain(label);
    }
    expect(frontliner).toMatch(/totals\.services/);
    expect(frontliner).toMatch(/totals\.sales/);
    expect(frontliner).toMatch(/totals\.manualNet/);
    expect(frontliner).toMatch(/expectedCash/);
  });

  it("pembayaran lewat detail servis, bukan dari dashboard", () => {
    // Dashboard tidak punya tombol bayar. Baris daftar servis membuka
    // `/app/servis/{id}` dan pembayaran dilakukan di halaman detail.
    expect(frontliner).not.toMatch(/PaymentDialog/);
    expect(frontliner).toMatch(/`\/app\/servis\/\$\{item\.id\}`/);
    expect(technician).toMatch(/`\/app\/servis\/\$\{item\.id\}`/);
  });

  it("warna candy diambil dari sumbu color SmoothUI, bukan hex manual", () => {
    // 4 warna dengan makna: accent, amber, green, blue. `destructive` dan
    // `neutral` sengaja tidak ada - tidak ada kartu yang maknanya "bahaya".
    expect([...CANDY_CARD_COLOR]).toEqual(["accent", "amber", "green", "blue"]);
    expect(new Set(CANDY_CARD_COLOR).size).toBe(CANDY_CARD_COLOR.length);
    for (const source of [technician, frontliner]) {
      // Hex warna tidak boleh ditulis di dashboard; semuanya lewat prop
      // `candy` yang warnanya milik SmoothUI.
      expect(source).not.toMatch(/#[0-9A-Fa-f]{6}/);
      expect(source).not.toMatch(/action="/);
    }
  });

  it("To-Do dipangkas lima baris dan sisanya pindah ke popover", () => {
    expect(taskNoteCard).toMatch(/compactLimit = 5/);
    expect(taskNoteCard).toMatch(/Lihat semua/);
    expect(taskNoteCard).toMatch(/Popover/);
  });

  it("Target saya jadi progress bar datar, bukan gauge busur", () => {
    // Konsep Figma memakai bar horizontal dengan persentase di kanan atas.
    // Gauge busur 270 derajat yang pernah dibuat sudah dihapus.
    expect(technician).toMatch(/role="progressbar"/);
    expect(technician).toMatch(/Servis selesai/);
    expect(technician).not.toMatch(/TargetGauge/);
    expect(frontliner).not.toMatch(/TargetGauge/);
  });

  it("KPI frontliner: masuk, selesai, diambil - tanpa Batal", () => {
    expect(frontliner).toMatch(/"Masuk"/);
    expect(frontliner).toMatch(/"Selesai"/);
    expect(frontliner).toMatch(/"Diambil"/);
    expect(frontliner).not.toMatch(/Batal/);
  });

  it("satu warna netral untuk semua kartu data", () => {
    // Konsep Figma: semua kartu data punya latar abu-abu yang sama. Warna
    // hanya untuk kartu aksi, lewat `candy` yang warnanya milik SmoothUI -
    // jadi BentoCard tidak punya daftar warna sendiri.
    expect(bentoCard).not.toMatch(/BENTO_TONES/);
    expect(bentoCard).not.toMatch(/TONE_BG/);
    expect(bentoCard).not.toMatch(/ACTION_COLOR|ACTION_IDLE|ACTION_RING/);
    expect(bentoCard).toMatch(/candy\?: CandyCardColor/);
    expect(bentoCard).toMatch(
      /candy \? CANDY_CARD : surface === "white" \? WHITE : surface === "plain" \? PLAIN : NEUTRAL/,
    );
  });

  it("hover datar: netral E7E7E7 ke ECECEC, tanpa lift", () => {
    // Keluhan sebelumnya: hover terlalu tebal dan besar. Sekarang kartu
    // hanya berganti warna satu tingkat, tanpa shadow yang menumpuk.
    expect(bentoCard).toMatch(/#E7E7E7/);
    expect(bentoCard).toMatch(/hover:bg-\[#ECECEC\]/);
    expect(bentoCard).not.toMatch(/hover:shadow/);
    expect(bentoCard).not.toMatch(/0_10px_28px|10px_28px/);
  });

  it("kartu aksinya permukaannya sendiri, bukan tombol di dalam kartu", () => {
    // Permukaan candy diambil dari varian `candy` SmoothUI, bukan disalin.
    // Kalau BentoAction masih ada, kartu jadi dua permukaan yang saling
    // bersaing - itu yang diminta untuk dibuang.
    expect(bentoCard).toMatch(/CANDY_CARD/);
    expect(bentoCard).toMatch(/candyCardColorClass/);
    expect(bentoCard).not.toMatch(/BentoAction/);
    expect(bentoCard).not.toMatch(/smoothButtonVariants/);
    for (const source of [technician, frontliner]) {
      expect(source).not.toMatch(/BentoAction/);
    }
    // Jejak percobaan sebelumnya harus hilang total.
    expect(pearlButtonExists).toBe(false);
    expect(globalsCss).not.toMatch(/pearl-button/);
  });

  it("kelas candy punya satu sumber kebenaran di smooth-button", () => {
    // Varian `candy` dan sumbu warnanya diekstrak ke konstanta, lalu dipakai
    // baik tombol maupun kartu. Kalau kartu menyalin kelasnya sendiri, dua
    // tempat bisa berbeda begitu SmoothUI diperbarui.
    expect(smoothButton).toMatch(/const CANDY_CLASSES/);
    expect(smoothButton).toMatch(/candy: CANDY_CLASSES/);
    expect(smoothButton).toMatch(/const CANDY_COLOR_CLASSES/);
    expect(smoothButton).toMatch(/export const CANDY_CARD = CANDY_CLASSES/);
  });

  it("warna candy berbeda per kartu aksi", () => {
    // Semantik: accent = Servis baru (pekerjaan utama, warna brand),
    // blue = Sparepart, amber = Catat Kas, green = Penjualan.
    // Kedua kartu aksi teknisi harus berbeda, kalau tidak pink mendominasi.
    expect(frontliner).toMatch(/candy="accent" href="\/app\/servis\/baru"/);
    expect(frontliner).toMatch(/candy="amber" onClick/);
    expect(frontliner).toMatch(/candy="green" href="\/app\/penjualan"/);
    expect(technician).toMatch(/candy="accent" href="\/app\/servis\/baru"/);
    expect(technician).toMatch(/candy="blue" href="\/app\/inventori"/);
  });

  it("tidak ada dua kartu aksi bersebelahan dengan warna sama", () => {
    // Warna candy hanya ada di kartu aksi. Kalau satu warna dipakai dua kali
    // di satu dashboard, perbedaannya hilang dan kartu terlihat kembar.
    for (const [name, source] of [
      ["teknisi", technician],
      ["frontliner", frontliner],
    ] as const) {
      const used = [...source.matchAll(/<BentoCard candy="(\w+)"/g)].map((m) => m[1]);
      expect(used.length, name).toBeGreaterThanOrEqual(2);
      expect(new Set(used).size, name).toBe(used.length);
    }
  });

  it("tinggi mengikuti isi: baris tetap 10.5rem, bukan kunci viewport", () => {
    // `h-dvh` + `grid-rows-3` memaksa tiap sel jadi tepat 1/3 layar: di
    // monitor besar kartu jadi tinggi dan kosong, di laptop tergepeng.
    // Frame Figma memakai baris tetap 10.5rem dan halaman boleh menggulir.
    expect(bentoCard).toMatch(/sm:auto-rows-\[10\.5rem\]/);
    expect(bentoCard).not.toMatch(/max-h-\[calc\(100dvh/);
    // Mobile dua kolom, desktop empat kolom.
    expect(bentoCard).toMatch(/grid-cols-2/);
    expect(bentoCard).toMatch(/sm:grid-cols-4/);
    for (const source of [technicianCode, frontlinerCode]) {
      expect(source).toMatch(/BENTO_GRID_CLASS/);
      // Kunci viewport yang dihapus, dan `grid-rows-3` yang membagi rata.
      // Dicek dari kode tanpa komentar: kedua kelas ini sengaja disebut
      // di komentar penjelas, jadi akan cocok kalau komentar ikut dibaca.
      expect(source).not.toMatch(/h-dvh overflow-hidden/);
      expect(source).not.toMatch(/sm:grid-rows-3/);
    }
  });

  it("kartu netral mengisi sel, kartu hug ikut isinya", () => {
    // `h-full` + `min-h-0` mengisi sel grid; `hug` membalik itu untuk
    // kartu yang isinya pendek, supaya tidak terlihat setengah kosong.
    expect(bentoCard).toMatch(/hug \? "h-fit" : "h-full"/);
    expect(bentoCard).toMatch(/hug && "self-start"/);
    expect(frontliner).toMatch(/span=\{2\} hug/);
  });

  it("sel yang isinya panjang menggulir di dalam, kartunya tidak", () => {
    for (const source of [technician, frontliner]) {
      expect(source).toMatch(/overflow-y-auto/);
    }
  });

  it("interaksi agenda: baris penuh bisa diketuk, coret menempel pada teks", () => {
    // Diported dari komponen MinimalAgendaWidget: tombolnya membungkus seluruh
    // baris (bukan hanya checkbox di kiri), dan garis coret lebarnya mengikuti
    // lebar teks - bukan lebar baris.
    expect(taskNoteCard).toMatch(/function AgendaTitle/);
    expect(taskNoteCard).toMatch(/transition-\[width\]/);
    expect(taskNoteCard).toMatch(/w-full.*group-data-done|done \? "w-full" : "w-0"/);
    // Baris bisa diketuk untuk toggle, dengan aria-pressed seperti aslinya.
    expect(taskNoteCard).toMatch(/aria-pressed=/);
  });

  it("To-Do memuat data asli, bukan agenda mock", () => {
    // Komponen MinimalAgendaWidget aslinya memuat tiga item hardcoded
    // di useState. Kalau itu masuk apa adanya, daftar tugas asli hilang.
    expect(taskNoteCard).toMatch(/getMyTodos/);
    expect(taskNoteCard).toMatch(/toggleTodo/);
    expect(taskNoteCard).toMatch(/deleteTodo/);
    expect(taskNoteCard).toMatch(/updateTodo/);
    expect(taskNoteCard).not.toMatch(/Design review|Client sync|Ship components/);
  });

  it("kartu Servis Masuk 460px sudah dibuang dari frontliner", () => {
    expect(frontliner).not.toMatch(/h-\[460px\]/);
    expect(frontliner).not.toMatch(/queue\.slice\(0, 12\)/);
  });

  it("tidak ada lagi highlight candy di bento 'Servis baru'", () => {
    // Semua sel bento sekarang rata: tidak ada gradasi, tidak ada glow.
    // Gaya candy hanya boleh lewat CandyButton (mis. "Tutup Toko").
    expect(bentoCard).not.toMatch(/CANDY_BENTO_CLASS/);
    expect(bentoCard).not.toMatch(/radial-gradient/);
    expect(bentoCard).not.toMatch(/candy\?: boolean/);
    for (const source of [technician, frontliner]) {
      expect(source).not.toMatch(/candy=\{/);
      expect(source).not.toMatch(/candy: true/);
    }
  });

  it("CandyButton tetap ada untuk aksi tunggal", () => {
    expect(frontliner).toMatch(/<CandyButton[\s\S]*?Tutup Toko[\s\S]*?<\/CandyButton>/);
    expect(CANDY_BUTTON_TONES.length).toBeGreaterThanOrEqual(4);
  });

  it("label menu beranda sudah 'Home', key-nya tetap", () => {
    expect(manifest).toMatch(/key: "dashboard",[\s\S]*?label: "Home"/);
  });
});
