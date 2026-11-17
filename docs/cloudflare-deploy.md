# Deploy ke Cloudflare Workers

Project ini di-deploy sebagai Worker via **Workers Builds** (Git integration), bukan Next.js standar.

## Build settings (Cloudflare Dashboard → Worker → Settings → Build)

- **Build command:** `npm run build`
- **Deploy command:** `npm run deploy`
- **Root directory:** kosong (root repo)
- Worker name harus `cervise` (sama dengan `name` di `wrangler.jsonc`).

`npm run deploy` menjalankan `opennextjs-cloudflare build && opennextjs-cloudflare deploy`.
Versi adapter di-pin ke `@opennextjs/cloudflare@1.20.7` karena mendukung Next.js 16.3.6.

## Build vs Retry

Workers Builds hanya membuat build baru saat ada **push** ke branch yang terhubung.
Tombol **Retry build** menjalankan ulang **commit lama** — jangan dipakai untuk mengambil perubahan `package.json` terbaru.

## Environment variables

- Build-time (`NEXT_PUBLIC_*` di-inline saat build): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`.
- Runtime secrets: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `FONNTE_TOKEN`, `OWNER_WHATSAPP_NUMBER`.

## Cron

Route `/api/cron/*` tidak berjalan otomatis di Workers. Buat **Cron Trigger** di Cloudflare yang memanggil endpoint tersebut dengan header `Authorization: Bearer $CRON_SECRET`.
