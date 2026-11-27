# Desain: UX error global & validasi field

Tanggal: 2026-11-27

## Konteks

Di kaggo.app, pesan error yang tampil ke pengguna sering berupa teks teknis
(minified Next.js, pesan Supabase/PostgREST, `Failed to fetch`) yang tidak bisa
ditindaklanjuti orang awam. Form juga hanya menampilkan satu banner error di
atas, tanpa menandai field yang salah, sehingga pengguna tidak tahu harus
mengubah apa.

Infrastruktur yang sudah ada:

- `src/components/ui/sonner.tsx` dipasang di root layout dan memanggil
  `installToastSoundBridge()` dari `src/lib/sound.ts`. Jembatan ini memodifikasi
  objek `toast` singleton sekali saat modul dimuat, sehingga seluruh
  `toast.error(...)` di aplikasi terkena efeknya tanpa mengubah call site.
- `src/components/ui/input.tsx` sudah punya gaya `has-aria-invalid` (border
  merah), jadi field tinggal menandai `aria-invalid`.
- `src/components/ui/field.tsx` menyediakan `FieldError` dari Base UI.
- `src/lib/platform/create-tenant-error.ts` sudah memetakan error teknis ke
  pesan ramah untuk satu kasus khusus.

## Tujuan

1. Semua `toast.error` menampilkan pesan yang bisa dipahami pengguna awam.
2. Error yang tidak bisa dipetakan tetap tidak menampilkan teks teknis mentah.
3. Field form yang invalid ditandai merah dan diberi pesan spesifik di dekat
   field tersebut, bukan hanya banner di atas.
4. Perubahan bersifat global untuk toast, dan terfokus pada form prioritas.

## Non-tujuan

- Mengubah format respons API atau kontrak server action.
- Mengubah seluruh form di aplikasi sekaligus.
- Menampilkan stack trace atau detail teknis kepada pengguna.

## Desain

### 1. `src/lib/error-message.ts`

Fungsi murni:

```ts
export function friendlyErrorMessage(error: unknown, fallback?: string): string
```

Aturan:

- Ambil `error.message` untuk `Error`, `String(error)` untuk sisanya.
- **Pass-through** untuk pesan yang sudah ramah (bahasa Indonesia atau kalimat
  manusia biasa). Hanya pesan yang cocok pola teknis yang diganti — ini
  mencegah pesan validasi spesifik seperti "Nama cabang wajib" ikut hilang.
- Pemetaan teknis:
  - `23505` / `duplicate key` → "Data sudah terdaftar. Periksa kembali."
  - `23503` / `foreign key` → "Data masih dipakai di transaksi lain."
  - `42501` / `permission denied` / `row-level security` → "Akses ditolak. Periksa hak akses Anda."
  - `PGRST` / `JWT` / `401` / `403` → "Sesi berakhir. Silakan masuk ulang."
  - `Invalid login credentials` → "Email atau password salah."
  - `Email not confirmed` → "Email belum terverifikasi. Cek kotak masuk Anda."
  - `Failed to fetch` / `NetworkError` / `ERR_` → "Koneksi terputus. Periksa internet lalu coba lagi."
  - `ChunkLoadError` / `Loading chunk` / `removeChild` / string minified panjang → "Halaman perlu dimuat ulang."
  - `undefined`, `null`, `[object Object]`, kosong, atau tampak stack trace → fallback.
- Fallback default: `"Terjadi masalah. Coba lagi."`
- Buang newline dan batasi panjang (≈140 karakter).

### 2. Jembatan toast global

Di `installToastSoundBridge()` (`src/lib/sound.ts`), wrapper `api.error` dan
callback error `toast.promise` meneruskan pesan melalui `friendlyErrorMessage`
sebelum memanggil implementasi asli. Nilai bukan string (ReactNode) diteruskan
apa adanya. Tidak ada perubahan pada ~70 call site `toast.error`.

### 3. Error boundary & render error server

- `src/app/error.tsx` dan `src/app/global-error.tsx` tetap menampilkan pesan
  generik. `error.digest` diberi label "Kode bantuan" (bukan stack trace).
- `src/app/app/customer/page.tsx` tidak merender `error.message` mentah;
  memakai `friendlyErrorMessage(error)`.

### 4. Form prioritas

Form yang diubah ke validasi per-field:

- login
- servis (tambah & edit)
- kas (buka saldo, tutup saldo, adjustment)
- customer
- cabang (dialog & drawer)
- sparepart

Pola:

- State error berupa `Record<string, string>` yang dikunci per nama field.
- Fungsi validasi mengembalikan objek tersebut.
- Input diberi `aria-invalid={Boolean(errors.<field>)}` (CSS merah sudah ada).
- Pesan ditampilkan sebagai `<p className="text-xs text-destructive">` tepat di
  bawah input terkait.
- Banner atas tetap ada, tetapi hanya untuk error server yang tidak
  berasosiasi dengan field tertentu, dan sudah melewati `friendlyErrorMessage`.
- Submit dengan error menghentikan aksi dan tidak memanggil server action.

## Testing

- `src/lib/error-message.test.ts`: pass-through pesan ramah, setiap pola teknis,
  fallback, dan pemotongan panjang.
- Tes wiring: `sonner.tsx` tetap memasang jembatan dan jembatan memanggil
  `friendlyErrorMessage`.
- Verifikasi: `npx tsc --noEmit`, `npx vitest run`, cek browser untuk satu error
  validasi form dan satu error toast.

## Risiko

- Jembatan memodifikasi objek `toast` singleton. Pola ini sudah digunakan untuk
  suara dan terpasang sekali dengan guard, jadi risikonya rendah; guard
  mencegah double-wrapping.
- Daftar pola teknis bersifat heuristik. Pass-through sebagai default
  memastikan pesan ramah yang belum dikenal tidak ikut berubah.
- Form di luar prioritas tetap memakai banner, tetapi pesannya ikut bersih
  lewat helper pada jembatan toast maupun pemanggilan eksplisit.
