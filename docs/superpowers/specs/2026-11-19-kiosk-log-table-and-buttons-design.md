# Log harian kiosk & status tombol — Desain

Tanggal: 2026-11-19
Status: disetujui (brainstorming 2026-11-19)

## Tujuan

Tabel log harian di kiosk `absen.kaggo.app` harus menampilkan baris absen karyawan, sehingga state tombol Masuk/Pulang mengikuti kondisi absen hari ini. Tombol **Absen Pulang** berwarna merah.

## Root cause

- Sesi kiosk menyimpan `employeeId` = `employees.id` (baris karyawan).
- `attendance_records.employee_id` menyimpan `profiles.id` (dari `submit_attendance_pin` memakai `v_employee.profile_id`).
- Halaman `/absen-kiosk` memfilter view `attendance_rekap` dengan `.eq("employee_id", session.employeeId)` — ids tidak cocok, sehingga `todayRow` selalu kosong dan tabel tidak bertambah. Logika disable tombol sudah benar tetapi tidak pernah aktif.

Bukti DB: `employees.id = e8a9d100…`, `profile_id = 6d6124e1…`, `attendance_records.employee_id = 6d6124e1…`.

## Keputusan

1. Halaman kiosk mengambil `profile_id` dari tabel `employees` berdasarkan `session.employeeId`, lalu memfilter absen dengan `profile_id` tersebut.
2. Tidak mengubah format sesi/RPC — `employeeId` di sesi tetap `employees.id` (dipakai RPC tulis).
3. Tombol **Absen Masuk** disabled saat `check_in_at` sudah ada; **Absen Pulang** aktif hanya saat sudah masuk dan belum pulang; keduanya disabled saat pending.
4. Tombol **Absen Pulang** memakai `variant="destructive"` (merah). Tombol Masuk tetap variant utama.
5. Tidak ada perubahan DB.

## Non-goal

- Peta/lokasi visual.
- Notifikasi WhatsApp absen.
- Perubahan sesi PIN.

## Verifikasi

- Test: mock `createAdminClient` & `readSession`, pastikan filter `attendance_rekap` memakai `profile_id` hasil lookup.
- Build & lint tidak ada error di file kiosk.
- Manual: login kiosk → klik Absen Masuk → halaman reload → Masuk disabled, Pulang merah & aktif → klik Pulang → keduanya disabled, tabel menampilkan jam masuk & pulang.
