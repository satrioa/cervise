"use client";

/**
 * Dipakai hanya kalau root layout sendiri gagal render. Karena root layout
 * tidak sempat jalan, globals.css belum tentu termuat — jadi halaman ini
 * sengaja memakai style inline, bukan kelas Tailwind/token.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#ffffff",
          color: "#171717",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          textAlign: "center",
        }}
      >
        <main style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Terjadi kesalahan</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#525252", marginTop: 12 }}>
            Aplikasi gagal dimuat. Muat ulang halaman; kalau tetap gagal, hubungi admin.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #d4d4d4",
              background: "#171717",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Muat ulang
          </button>
        </main>
      </body>
    </html>
  );
}
