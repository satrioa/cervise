# Deploy ke Cloudflare Workers

Project ini di-deploy sebagai Worker via **Workers Builds** (Git integration), bukan Next.js standar.

## Build settings (Cloudflare Dashboard → Worker → Settings → Build)

- **Build command:** `npm run build`
- **Deploy command:** `npm run deploy`
- **Root directory:** kosong (root repo)
- Worker name harus `cervise` (nama teknis di `wrangler.jsonc` sengaja tidak ikut direname).

`npm run deploy` menjalankan `opennextjs-cloudflare build && opennextjs-cloudflare deploy`.
Versi adapter di-pin ke `@opennextjs/cloudflare@1.20.7` karena mendukung Next.js 16.3.6.

## Build vs Retry

Workers Builds hanya membuat build baru saat ada **push** ke branch yang terhubung.
Tombol **Retry build** menjalankan ulang **commit lama** — jangan dipakai untuk mengambil perubahan `package.json` terbaru.

## Environment variables

- **Build variables** (WAJIB,Workers Builds → Settings → Build → Build variables and secrets): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`. Next.js meng-inline `NEXT_PUBLIC_*` saat `next build`, jadi mengisinya hanya di runtime tidak cukup — build harus diulang setelah variabel ini tersedia.
- **Runtime secrets** (Settings → Variables & Secrets, tipe Secret): `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `FONNTE_TOKEN`.
- **Runtime variables**: `OWNER_WHATSAPP_NUMBER` (dan `NEXT_PUBLIC_*` juga boleh, tidak merusak).

Jangan menaruh nilai secret di `wrangler.jsonc` — gunakan `secrets.required` hanya untuk nama, atau simpan di dashboard / `.dev.vars` lokal.

## Troubleshooting: login error "Your project's URL and API key are required"

Error ini muncul dari browser (`createBrowserClient`), bukan dari Worker. Artinya `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` tidak ada **saat build**. Mengisinya hanya di runtime (Settings → Variables & Secrets) tidak cukup: Next.js mengganti `process.env.NEXT_PUBLIC_*` dengan nilai literal di bundle Javascript saat `next build`. Tambahkan ke **Build variables**, lalu lakukan build baru (push) — Retry build memakai bundle lama.

## Cron

Route `/api/cron/*` tidak berjalan otomatis di Workers. Buat **Cron Trigger** di Cloudflare yang memanggil endpoint tersebut dengan header `Authorization: Bearer $CRON_SECRET`.
