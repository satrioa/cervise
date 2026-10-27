# Cetak Nota ke Printer Thermal

Nota **Penjualan** dan **Servis** bisa dicetak langsung ke printer thermal 58mm
(iWare ZJ-5809 dan sejenisnya) tanpa dialog print browser.

Modul: `src/lib/printer/`

| File | Isi |
|---|---|
| `escpos.ts` | Perintah ESC/POS: init, teks, bold, ukuran, feed, QR (`GS ( k`), cut, kolom 32 |
| `receipt.ts` | Layout nota penjualan (tanpa QR) dan servis (QR lacak) |
| `logo.ts` | Logo → bitmap raster (`GS v 0`) |
| `transports/webBluetooth.ts` | BLE/GATT — Chrome/Edge Windows, Chrome Android |
| `transports/webSerial.ts` | Kabel USB / port COM — Chrome/Edge desktop |
| `transports/browserPrint.ts` | Fallback `window.print()` |
| `detect.ts` | Daftar transport + prioritas |
| `storage.ts` | Ingatan perangkat (localStorage) |
| `index.ts` | `connectPrinter`, `printReceipt`, `getPrinterStatus`, `disconnectPrinter` |

## Browser yang didukung

| Platform | Cetak langsung | Catatan |
|---|---|---|
| Windows 11 + Chrome/Edge | Bluetooth BLE, USB/COM | Target utama |
| Android + Chrome | Bluetooth BLE | Web Serial tidak ada di Android |
| iOS / Safari | Tidak — **no MFi support; SPP unavailable** | Otomatis jatuh ke dialog cetak; printer thermal 58mm bukan AirPrint |

Kalau tidak ada transport yang didukung, `printReceipt` membuka nota HTML di
jendela baru dan memanggil `window.print()`. Nota tidak pernah hilang karena
printer gagal.

## Menyiapkan printer

### Windows 11 — Bluetooth

1. Nyalakan printer, aktifkan mode pairing.
2. **Settings → Bluetooth & devices → Add device → Bluetooth**, pilih
   `ZJ-5809`. Kalau ada dua entri (BLE dan Classic), coba yang BLE.
3. Buka aplikasi di Chrome/Edge (HTTPS atau `localhost`).
4. Buka **Pengaturan → General → Printer Nota** (Master Admin), atau menu
   grid → **Printer Nota** (Frontliner/Teknisi). Klik **Hubungkan Printer**,
   pilih printer di chooser Chrome. Kalau muncul **"Unknown or Unsupported
   Device"**, lihat bagian pemecahan masalah.
5. Klik **Cetak Tes**.

### Windows 11 — Kabel USB

Printer USB 58mm biasanya memakai chip CH340/CP210x dan muncul sebagai COM
port. **Jangan** pasang driver printer untuk port itu — yang dibutuhkan driver
serial. Setelah port muncul di Device Manager:

1. **Pengaturan → General → Printer Nota** (Master Admin) atau menu grid →
   **Printer Nota** (Frontliner/Teknisi) → **Hubungkan Printer**.
2. Pilih entri port COM printer (bukan nama printer).
3. Klik **Cetak Tes**.

### PC — Printer Bluetooth Classic → Web Serial

Kalau printer sudah di-pair di Windows (Classic, SPP), ia membuat COM port
(**More Bluetooth options → COM Ports**). Jalur cetaknya dari Cervise melalui
Web Serial: **Device Manager** → port COM printer → **Pilih baudRate**
(**Standard Serial over Bluetooth link**). Web Serial bekerja di Chrome/Edge
desktop dan tidak memerlukan driver printer.

### Android — Bluetooth Classic (SPP) via RawBT

Untuk printer Bluetooth Classic (SPP) di Android yang tidak mendukung BLE:

1. Pasang aplikasi **RawBT** (atau serupa) dari Play Store.
2. Pair printer di **Setelan → Bluetooth** Android.
3. Di pengaturan RawBT, aktifkan **auto-print** dan **tanpa konfirmasi** (no-confirmation).
4. Buka aplikasi di Chrome dan cetak; Cervise bergantung pada aplikasi pihak ketiga (RawBT) untuk meneruskan data SPP.

### Android — Bluetooth

1. Pair printer di **Setelan → Bluetooth**.
2. Buka aplikasi di Chrome, izinkan **Bluetooth** dan **Lokasi**.
3. Menu grid → **Printer Nota** → **Hubungkan Printer**, pilih printer.
4. Cetak tes.

### Pilih baudRate

Baud rate default: **9600**. Opsi lain: **19200**, **38400**, **115200**.

## Cara pakai

- **Penjualan**: setelah pembayaran, dialog nota → **Cetak Nota**. Cetak ulang
  dari **Riwayat** memakai jalur yang sama.
- **Servis**: tombol cetak → pilih **Thermal**. Pilihan **Jet** dan **Dot
  Matrix** tetap lewat dialog cetak (bukan ESC/POS).
- Cetak massal (bulk) tetap memakai dialog cetak browser: satu klik tidak bisa
  memicu chooser perangkat berkali-kali.

Cetak pertama selalu memunculkan chooser perangkat — itu wajib dari browser.
Setelah dipilih, cetak berikutnya memakai `getDevices()`/`getPorts()` dan
tersambung otomatis. Tombol **Putuskan** melepas koneksi; pilihan perangkat
tetap diingat.

## Format nota

- 32 kolom Font A (58mm). Ganti `PAPER_COLS` untuk printer 80mm (48 kolom).
- Nama toko dua kali tinggi dan tebal; perataan memakai spasi, bukan `ESC a`,
  supaya aman di printer murah.
- Karakter non-ASCII dinormalkan (`·` → `-`, spasi non-breaking → spasi, emoji
  → `?`).
- **Cut tidak dikirim** — tidak semua printer punya cutter. `cut()` tersedia
  kalau nanti diperlukan.
- QR servis memakai perintah native `GS ( k` berisi
  `{origin}/{slug}/lacak/{kode}`. Penjualan tidak memakai QR karena belum ada
  halaman lacak penjualan.

## Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| Chooser menampilkan **"Unknown or Unsupported Device"** | Chrome melihat perangkat tapi tidak bisa membaca layanan BLE. Unpair dulu di Windows, nyalakan ulang printer, scan lagi. Kalau tetap, printer kemungkinan Classic-only → pakai USB/COM. Cek dengan nRF Connect: kalau service `Write` bukan salah satu UUID di `webBluetooth.ts`, tambahkan pasangan UUID itu ke `CANDIDATES`. |
| Printer tidak muncul di chooser | Belum di-pair di OS, printer sedang tersambung ke HP lain, atau Classic-only. |
| `NotFoundError` / izin ditolak | Izin Bluetooth diblokir untuk situs. Buka ikon gembok di address bar → izinkan Bluetooth, lalu muat ulang. |
| Cetak Bluetooth gagal di Android | Pastikan izin **Lokasi** aktif (syarat scan BLE di Android lama) dan printer tidak sedang dipakai aplikasi vendor. |
| Web Serial: port gagal dibuka | Driver printer mengklaim port. Pasang driver serial (CH340/CP210x), bukan driver printer. |
| Teks terpotong | Nama/alamat lebih dari 32 karakter dibungkus otomatis; item panjang dipotong. Periksa `PAPER_COLS` kalau memakai kertas 80mm. |
| Hasil kosong tapi tidak ada error | Printer menerima data tapi tidak mencetak: cek kertas, atau perintah tidak cocok (bukan ESC/POS). |
| Logo pecah / hilang | Logo diambil dari URL publik; kalau gagal dimuat nota tetap tercetak tanpa logo. Ambang hitam-putih ada di `logo.ts` (luma < 160). |

## Menambah transport baru

1. Buat file di `transports/` yang mengimplementasikan `PrinterTransport`
   (`src/lib/printer/types.ts`).
2. Tambahkan satu baris di `detect.ts`.
3. Tidak ada perubahan di `receipt.ts` atau UI.

Contoh ke depan: `capacitorBle.ts` untuk iOS lewat aplikasi native.
