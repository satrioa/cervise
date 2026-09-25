# Branch Switcher di Dalam Kartu Tenant — Design

Tanggal: 2026-09-25  
Status: Struktur disetujui pengguna; menunggu tinjauan dokumen spec.

## Tujuan

Memindahkan `BranchSwitcher` ke dalam section kartu `TenantSwitcher`, tepat di bawah tombol tenant aktif. Setelah perubahan ini, `SidebarContent` hanya merender `TenantSwitcher`; pemanggilan `BranchSwitcher` secara terpisah dihapus.

## Konteks saat ini

- `TenantSwitcher`: `src/components/layout/app-shell.tsx:157-183`
- `BranchSwitcher`: `src/components/layout/app-shell.tsx:185-242`
- Blok atas sidebar yang sekarang memuat keduanya: `src/components/layout/app-shell.tsx:251-254`
- Section kartu tenant: `src/components/uitripled/multiple-accounts-shadcnui.tsx:73-82`
- Dropdown/list tenant: `src/components/uitripled/multiple-accounts-shadcnui.tsx:108-174`

## Pendekatan yang dipilih

Gunakan slot konten opsional pada komponen tenant dan teruskan `BranchSwitcher` sebagai isi kartu. Pendekatan ini dipilih karena:

- Perubahannya kecil dan terarah.
- Hubungan konteks menjadi eksplisit: tenant sebagai kartu induk, branch sebagai pilihan di dalamnya.
- Dropdown tenant tidak diubah.
- Provider, routing, penyimpanan lokal/cookie, dan event branch/tenant tidak diubah.

Pendekatan yang ditolak:

- Menaruh branch di dalam dropdown tenant: branch menjadi sulit ditemukan dan mencampur dua konteks pemilihan.
- Membuat komponen workspace gabungan baru: refactor lebih besar daripada yang dibutuhkan permintaan ini.

## Desain komponen

1. Tambahkan prop `children?: React.ReactNode` pada `MultipleAccounts`.
2. Render konten tersebut di dalam `motion.section`, di bawah tombol tenant aktif dan di atas area dropdown.
3. Di `TenantSwitcher`, teruskan `<BranchSwitcher />` melalui slot tersebut untuk kondisi tenant normal.
4. Hapus `<BranchSwitcher />` dari blok atas `SidebarContent`, sehingga blok tersebut hanya berisi `<TenantSwitcher />`.
5. Untuk kondisi tenant sedang memuat atau daftar tenant kosong, tetap tampilkan akses branch langsung di bawah pesan tenant agar pengguna tidak kehilangan kemampuan mengganti branch.
6. Jangan memindahkan `TenantProvider` atau `BranchProvider`; keduanya tetap membungkus `AppShellInner`.

## Alur data dan perilaku

- Pemilihan tenant tetap memakai `setActiveOrg` dan perilaku reload yang ada.
- Pemilihan branch tetap memakai `setBranch` dan penyimpanan branch yang ada.
- Dropdown tenant dan popover branch mempertahankan perilaku bukanya masing-masing.
- Tidak ada perubahan format data tenant, branch, cookie, localStorage, atau event lintas tab.

## Penanganan error dan edge case

- Tenant loading: tampilkan pesan loading dan tetap sediakan branch switcher.
- Tidak ada tenant: tampilkan pesan tenant kosong dan tetap sediakan branch switcher.
- Daftar branch kosong: pertahankan perilaku branch yang sudah ada; perubahan ini tidak menambah sumber branch baru.
- Sidebar desktop dan drawer mobile memakai `SidebarContent` yang sama, sehingga perubahan berlaku untuk keduanya.

## Verifikasi

Jalankan:

- `npm run typecheck`
- `npm run lint`
- `npm test`

Verifikasi manual:

- Buka sidebar desktop dan drawer mobile.
- Pastikan branch tampil di dalam kartu tenant.
- Buka dropdown tenant dan popover branch tanpa terpotong.
- Periksa kondisi tenant loading/kosong tetap memberi akses branch.

## Batasan scope

Spec ini hanya mencakup pemindahan dan komposisi ulang switcher. Tidak mencakup refactor `app-shell.tsx`, desain ulang kartu tenant, perubahan state global, atau penambahan framework testing DOM.
