# Sound Design — Cervise UI

Sistem suara UI untuk seluruh aplikasi Cervise (desktop + mobile). Sumber file:
`docs/Music/*.wav` (di-replikasi ke `public/sounds/`). Seluruh pemutarannya
diatur oleh satu modul: **`src/lib/sound.ts`**, dan komponen cukup memanggil
API semantik `sfx.*`.

---

## 1. Peta sound pool

| File              | Nama semantik | Volume default | Peran di produk                          |
| ----------------- | ------------- | -------------- | ---------------------------------------- |
| `Close1.wav`      | `close1`      | 50%            | Menutup popover / modal / sheet / alert  |
| `Close2.wav`      | `close2`      | 55%            | Batal, buang perubahan, discard          |
| `dew.wav`         | `dew`         | 40%            | Klik generik (varian A, acak)            |
| `boop.wav`        | `boop`        | 40%            | Klik generik (varian B, acak)            |
| `dot.wav`         | `dot`         | 50%            | Aksi memilih / pick                      |
| `undo.wav`        | `undo`        | 50%            | Berganti tab                             |
| `arrive.wav`      | `arrive`      | 70%            | Notifikasi masuk                         |
| `notch.wav`       | `notch`       | 45%            | Menekan tombol                           |
| `clasp.wav`       | `clasp`       | 60%            | Toggle ON (menyalakan)                   |
| `unclasp.wav`     | `unclasp`     | 60%            | Toggle OFF (mematikan)                   |
| `shake.wav`       | `shake`       | 70%            | Aksi gagal                               |
| `chime.wav`       | `chime`       | 70%            | Aksi sukses                              |
| `spring.wav`      | `spring`      | 50%            | Cadangan (lihat §8) — belum otomatis     |

Volume ditetapkan di dalam `playSound` (SOUND_VOLUME) supaya kesamaan dB antar
file tidak perlu dipikirkan pemanggil; file sumber memang punya loudness yang
bervariasi.

---

## 2. Aturan main

1. **Suara hanya lahir dari interaksi pengguna.** Tidak ada suara saat halaman
   dimuat, saat refetch latar belakang, atau saat render. Ini juga syarat
   kebijakan autoplay browser.
2. **Satu interaksi = satu suara.** Ketika satu klik memicu dua peristiwa
   (mis. klik tombol X menutup dialog), nada yang lebih spesifik menang:
   tombol X diberi prop `sound={null}` sehingga hanya Close1 yang terdengar.
3. **Primitif yang membawa suara:** Button, Dialog, Sheet, Popover, Tabs,
   Switch, Select, dan samakan untuk komponen overlayer baru yang akan dibuat.
4. **Mute + volume:** satu store di `localStorage` key `cervise-sound`
   (JSON `{ muted, volume }`), dibaca via `useSoundSettings()` /
   `getSoundSnapshot()` dan ditulis via `writeSoundSettings()`. Volume adalah
   master gain (0–100) yang dikalikan dengan volume per-sound di `playSound`;
   mute membuat seluruh `sfx.*` no-op. Key lama `cervise_sound`
   (`"on"`/`"off"`) masih dibaca sekali lalu dimigrasikan, dan `setSoundEnabled`
   / `useSoundEnabled` tetap tersedia sebagai pembungkus mute saja. Perubahan
   dari tab lain ikut tersinkron lewat event `storage`. Kontrol pengguna:
   `SoundToggle` di footer sidebar (bukan top nav) untuk mute cepat, dan
   `MenuSound` (section "Sound System" di drawer menu) untuk mute + slider
   volume — keduanya memakai store yang sama sehingga selalu sinkron.
5. **Anti-dupe:** suara yang sama dalam jendela < 60 ms dipotong oleh
   `playSound`. Setiap sound punya pool 3 elemen audio yang dipakai bergiliran,
   jadi klik cepat tetap bisa tumpang tindih tanpa mengandalkan `cloneNode`
   (clone elemen media tidak selalu memuat resource di beberapa browser dan
   bisa membuat `play()` reject alias hening). Preload 13 file dilakukan di
   waktu idle setelah interaksi pertama, bukan saat mount.
6. **Error runtime hening.** Kegagalan `play()` (autoplay policy, tab tertutup)
   tidak pernah melempar; suara adalah pemanis, bukan jalur kritis.

---

## 3. Detail pemakaian per sound

### `Close1` — menutup overlayer
Menutup **popover, modal/dialog, sheet, dropdown, alert** — apapun cara
menutupnya (tombol X, tombol "Tutup", Escape, klik backdrop/backdrop blur).

Sudah otomatis di primitif:
- `Dialog` (`ui/dialog.tsx`) → setiap transisi open → false.
- `Sheet` (`ui/sheet.tsx`) → sama.
- `Popover` (`ui/popover.tsx`) → sama.
- `Menu` (`ui/menu.tsx`) → ditutup via Escape/klik luar; **tidak** saat menutup
  karena item dipilih (Dot yang mewakili aksi itu).
- `Select` (`ui/select.tsx`) → ditutup via Escape/klik luar; memilih nilai
  hanya memutar Dot.
- Command palette (`ui/command.tsx`) → Escape/klik luar.

Tombol X bawaan pada `DialogContent`/`SheetContent` sengaja membisukan Notch
(`sound={null}`) agar yang terdengar hanya Close1.

Jangan dipakai untuk menutup yang disertai aksi (simpan lalu tutup): gunakan
Chime/Close2 sesuai hasi aksinya.

### `Close2` — batal, buang, discard
Sengaja dipisah dari Close1 karena maknanya berbeda: Close1 = "kembali ke mana
kita tadi" (netral), Close2 = "yang saya isi tadi tidak jadi disimpan". Tempat
pemakaiannya:

- Tombol **Batal** pada form create/edit (servis baru, produk, karyawan).
- **Buang perubahan** pada dialog konfirmasi keluar tanpa menyimpan.
- **Discard draft** pada komposer (mention/notes sangat panjang).
- Tombol **tutup tanpa simpan** di drawer cetak/preview.

Cara pakai di call site (belum otomatis, karena "batal" adalah keputusan
bisnis tiap form):

```tsx
<Button variant="outline" onClick={() => { sfx.cancel(); setOpen(false); }}>
  Batal
</Button>
// Jika alur batal memunculkan toast.error, shake tetap bersuara — itu memang
// disengaja (lihat shake).
```

> Catatan: `installToastSoundBridge` di `src/lib/sound.ts` mengaitkan
> `toast.error` → shake secara global.

### `dew` + `boop` — klik generik (acak)
Efek klik untuk interaksi yang bukan "memilih" dan bukan tombol primitif:
- **membuka dropdown/menu/select/popover** dari trigger tombol mentah — bunyi
  "muncul" ini dilewati bila trigger-nya sudah berbunyi Notch/click;
- menekan **tombol mentah** (bukan primitif `Button`) di mana pun: ikon
  toolbar, tombol tutup kustom, tombol sort tabel, dll;
- menekan card/panel yang bisa diklik (daftar servis di view grid),
- chip/tag bermunculan (kerusakan tag),
- item list yang bisa dipilih tapi tidak mengubah state form.

Dipilih acak per kali klik (`sfx.click()`), distribusi 50/50, supaya klik
beruntun tidak membosankan seperti metronom. Kalau butuh pasti satu, panggil
`playSound("dew")` langsung.

### `Dot` — aksi memilih
Setiap kali pengguna memfinalkan pilihan antara beberapa opsi:
- memilih nilai di **Select** (dropdown) → otomatis via `ui/select.tsx`.
- **pilih cabang** di Branch Switcher (termasuk "Semua cabang") → di
  `lib/branch-context.tsx` saat `setBranch` dipanggil.
- item **Menu** (aksi baris tabel: detail/edit/hapus) → otomatis lewat
  SoundLayer (`role="menuitem"`).
- opsi **autocomplete / command palette** → otomatis (`role="option"`).
- **radio** pilihan tunggal → otomatis (`role="radio"`).
- memilih teknisi/pelanggan dari hasil pencarian (autocomplete/select).

Sengaja berbeda dari Undo: Dot menandai "saya menetapkan pilihan ini", Undo
menandai "saya berpindah konteks".

### `Undo` — berganti tab / pindah menu
Berpindah konteks:
- `Tabs` primitif (`ui/tabs.tsx`) → otomatis via onValueChange.
- **bottom-tab navigation mobile** di `app-shell.tsx` (Beranda/Laporan/
  Inventori/… dan "Lainnya"-sheet) → otomatis saat klik tab non-aktif.
- **semua tautan navigasi internal** — sidebar desktop, sheet menu mobile,
  breadcrumb, pagination → otomatis lewat SoundLayer: klik `<a>` yang benar-
  benar pindah halaman.
- Tab pada preview dokumen/cetak (Ringkasan / Rincian).

Tidak dipakai untuk: anchor di halaman yang sama (`#bagian`) dan tautan
eksternal (keduanya sengaja hening).

### `Arrive` — notifikasi masuk
Momen "ada yang datang untukmu":
- toast informasi (`toast(...)`, `toast.info(...)`, `toast.warning`) →
  otomatis lewat sound-bridge di `ui/sonner.tsx`,
- notifikasi WhatsApp/customer masuk (float banner, badge berubah),
- notifikasi servis baru ditugaskan ke teknisi.

### `Notch` — menekan tombol
Suara default SEMUA `<Button>` (via `ui/button.tsx`). Termasuk primary,
secondary, outline, ghost — logikanya "sesuatu tertekan dengan bahagia".

Pengecualian yang wajib dibisukan (`sound={null}`) supaya tidak bertumpuk:
- tombol X bawaan Dialog/Sheet (Close1 yang menang),
- tombol "Close" pada DialogFooter,
- trigger popover yang membuka editor besar (agar suara buka tidak dobel dengan
  Notch trigger), masih boleh di-alihkan ke `spring` bila momennya besar.

### `Clasp` / `Unclasp` — toggle ON / OFF
Toggle bicara dengan dua nada yang berpasangan: menyalakan terdengar
"klik-selak-terkunci" (clasp), mematikan terdengar "lepas" (unclasp).

- `Switch` primitif (`ui/switch.tsx`) → otomatis; suara mengikuti nilai baru.
- `Checkbox` (termasuk checkbox pilih-baris tabel) → otomatis: mencentang =
  clasp, melepas = unclasp.
- `Toggle` / `ToggleGroup` / segmented control (`aria-pressed`) → otomatis.
- Disclosure/accordion (`aria-expanded`) → buka = clasp, tutup = unclasp.
- Toggle aktif/not aktif pie chart/grafik yang custom setState:
  `checked ? sfx.toggleOn() : sfx.toggleOff()` di handler.

### `Shake` — aksi gagal
Selalu bersuara ketika aksi gagal:
- `toast.error(...)` → otomatis (sound-bridge).
- Validasi form menolak inline tetapi TIDAK memunculkan toast (mis. border
  merah dobel): panggil `sfx.error()` di handler submit saat validasi menolak.
- Aksi bulk/remote gagal di grid (konflik stok, koneksi putus).

Do not: shake untuk pesan peringatan tidak memblokir (pakai Arrive).

### `Chime` — aksi sukses
- `toast.success(...)` → otomatis (sound-bridge).
- Pembayaran/transaksi berhasil tersimpan (POS, bayar servis, retur).
- Upload foto selesai, backup/export selesai.
- Branch switch tersimpan server-side (setelah `router.refresh()`, suara Dot
  sudah dimainkan saat memilih; jangan dobel dengan chime — Dot telah
  menjadi konfirmasi).

---

## 4. Suara yang sengaja TIDAK otomatis

| Momen                            | Kenapa tidak otomatis                          | Cara mainkan |
| -------------------------------- | ----------------------------------------------- | ------------ |
| Batal / discard                  | Keputusan bisnis tiap form, tidak ada marker umum | `sfx.cancel()` |
| Failed submit non-toast          | Tidak semua validasi lewat toast                | `sfx.error()` di handler |
| Success submit non-toast         | Sama                                            | `sfx.success()` di handler |
| Onboarding / sheet besar         | Satu momen spesial                              | `sfx.spring()` |

---

## 5. Menonaktifkan suara per komponen

```tsx
<Button sound={null}>          // tombol hening (tapi tetap reaktif)
<Button sound="dot">           // override suara tombol jadi dot
<Button sound="error">         // tombol merah gagal, biar shake, bukan notch
```

`sound` bertipe `SoundName | null` (`src/lib/sound.ts`). Untuk komponen yang
bukan Button, langsung panggil `playSound(name)` / `sfx.*`.

---

## 6. Testing & QA

- Type & suara: `src/lib/sound.ts` adalah satu-satunya lapisan yang menyentuh
  file wav; untuk mengganti file cukup ubah `SOUND_SRC`.
- Suara tidak diuji di vitest (membutuhkan peramban); yang diuji adalah
  perilaku "tidak melempar error saat SSR" — sudah dijaga guard
  `typeof window === "undefined"`.
- QA manual: putar desktop + mobile; cek ikon speaker di footer sidebar /
  header mobile untuk mute/unmute (unmute harus berbunyi `chime`); klik tombol
  berkali-kali cepat (throttle 60 ms tidak boleh membuat suara hilang sekejap).
- Kalau hening padahal ikon speaker aktif: pastikan build yang dijalankan
  memang memuat folder `public/sounds/` (cek `/sounds/notch.wav` → HTTP 200
  `audio/wav`) dan tab browser tidak di-mute.
- Debug dari console browser (development): `__cerviseSfx.sfx.success()`,
  `__cerviseSfx.sfx.tab()`, `__cerviseSfx.sfx.click()`,
  `__cerviseSfx.isSoundEnabled()`, `__cerviseSfx.playedRecently("notch", 500)`,
  `__cerviseSfx.playCue("notify")`, `__cerviseSfx.getSoundSnapshot()`.

---

## 7. Jembatan toast (sinkron warna → suara)

Dipasang otomatis oleh `src/components/ui/sonner.tsx` (root layout yang selalu
memuat modul itu). Semantiknya:

| Call site                 | Suara   |
| ------------------------- | ------- |
| `toast.success(...)`      | chime   |
| `toast.error(...)`        | shake   |
| `toast.warning(...)`      | arrive  |
| `toast.info/...`/default  | arrive  |
| `toast.loading(...)`      | hening  |
| `toast.promise(p, {...})` | resolve → chime, reject → shake |

Semua call site toast lama otomatis bersuara tanpa perlu diubah — bridge
membungkus method `toast` pada module singleton sonner.

---

## 8. Cadangan: `spring.wav`

Belum dipakai otomatis. Nomor-nya disiapkan untuk momen "transisi besar":
drawer/sheet berlayar penuh, onboarding pertama kali. Dipanggil manual via
`sfx.spring()` saat dirasa perlu, JANGAN dijadikan suara default buka/ tutup —
terlalu berat untuk interaksi kecil.

---

## 9. Lapisan global (SoundLayer)

`src/components/layout/sound-layer.tsx` dipasang sekali di root layout dan
mengenali interaksi dari semantik DOM. Elemen "telanjang" (tanpa primitif)
tetap bersuara tanpa menambah `onClick` di ratusan call site.

| Yang diklik | Pengenal | Suara |
| ----------- | -------- | ----- |
| Tautan internal | `a[href]` origin sama, bukan `#anchor`, bukan tab baru/download | Undo |
| Tab kustom | `[role="tab"]` | Undo |
| Item menu | `[role="menuitem"]` / `menuitemcheckbox` / `menuitemradio` | Dot |
| Opsi autocomplete / command palette | `[role="option"]` | Dot |
| Radio | `[role="radio"]` | Dot |
| Checkbox / switch | `[role="checkbox"]`, `[role="switch"]` | clasp / unclasp |
| Toggle / segmented control | `[aria-pressed]` | clasp / unclasp |
| Accordion / disclosure | `[aria-expanded]` | clasp / unclasp |
| Tombol mentah | `button` (bukan primitif `Button`) | dew / boop acak |
| Manual | `data-sfx="<nama>"` | sesuai nama |

Catatan teknis:
- Listener berjalan di **fase capture**. Ini penting: suara dari layer ini
  sudah tercatat saat handler React milik Menu/Select/Popover memutuskan apakah
  perlu memutar suara buka. Hasilnya satu klik tetap satu suara.
- Tombol primitif ditandai `data-sfx-managed`; layer melewatinya karena Button
  sudah menangani Notch — termasuk tombol yang sengaja `sound={null}`.
- Klik kanan, klik sambil menyeleksi teks, dan kontrol `disabled`/`aria-disabled`
  diabaikan.
- `data-sfx-silent` mematikan suara untuk seluruh subtree (dipakai pada pilihan
  cabang, yang suaranya sudah dimainkan `setBranch()`).

```tsx
// escape hatch untuk komponen yang tidak punya role/aria yang dikenali
<div role="button" tabIndex={0} data-sfx="click">…</div>
<span data-sfx="dot">…</span>

// matikan suara pada subtree tertentu
<div data-sfx-silent>…</div>
```

---

## 10. Kompatibilitas shell baru

Shell baru (drawer menu + bottom bar) sempat memakai sistem suara sintesis Web
Audio dengan API `playCue("tap" | "success" | "error" | "notify")`. Sistem wav
ini sekarang menyediakan **shim** dengan nama yang sama, jadi call site di shell
baru tidak perlu diubah:

| `playCue(...)` | Suara wav |
| -------------- | --------- |
| `"tap"`        | Notch     |
| `"success"`    | Chime     |
| `"error"`      | Shake     |
| `"notify"`     | Arrive    |

Store preferensi juga disamakan: key `cervise-sound` dengan bentuk
`{ muted, volume }`, plus `DEFAULT_SOUND`, `getSoundSnapshot()`,
`subscribeSoundStore()`, `readSoundSettings()`, `writeSoundSettings()`, dan
`useSoundSettings()` — persis API yang dipakai `MenuSound` di shell baru.
`playCue` ikut menghormati mute dan volume karena memanggil `playSound`.

Saat menggabungkan shell baru:

1. Jangan menambah `SoundLayer` kedua — cukup yang di root layout.
2. Pertahankan `SoundToggle` di footer sidebar (mute cepat) dan `MenuSound` di
   drawer (mute + slider); keduanya berbagi store. **Top nav sengaja tanpa
   kontrol suara** — jangan menambahkan toggle di header.
3. Jika shell baru membuat primitif overlay sendiri (drawer/dropdown custom),
   ikuti pola `menu.tsx`/`popover.tsx`: `sfx.click()` saat buka,
   `sfx.close()` saat tutup, dengan guard `isFromManagedButton` /
   `playedRecently`.
4. Untuk item bottom-nav berbentuk `<button>` + `router.push`, beri
   `role="tab"` (otomatis Undo) atau `data-sfx="undo"`.
