import { resolveLoginAccess, fetchLoginAccess } from "./src/lib/auth/login-access";
import { getProtectedPathKind } from "./src/lib/auth/authorization";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default async function middleware(request: NextRequest) {
  // Path diteruskan ke server component lewat request header.
  //
  // `AppLayout` butuh tahu pathname untuk mengecualikan halaman subscription
  // dari gate langganan: tenant yang trial-nya habis harus tetap bisa membuka
  // halaman itu untuk membayar. `next-intl` menambah prefiks locale, jadi
  // path yang dibandingkan di layout adalah path SETELAH locale dihapus.
  request.headers.set("x-pathname", request.nextUrl.pathname);

  // Supabase session refresh.
  //
  // `next-intl` TIDAK dipakai di sini. Middleware-nya menulis
  // `x-middleware-rewrite` ke `/{locale}/...`, dan `src/app/[locale]/` tidak
  // pernah ada di repo ini -- jadi setiap rewrite mengarah ke route yang tidak
  // eksis dan semua halaman balas 404. Menggabungkan header response-nya saja
  // tidak menolong: yang hilang adalah rewrite-nya sendiri.
  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: auth } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  const protectedPathKind = getProtectedPathKind(pathname);

  if (protectedPathKind && !auth.user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (auth.user && protectedPathKind) {
    let access;
    try {
      access = await fetchLoginAccess(supabase);
    } catch {
      const errorUrl = new URL("/login", request.url);
      errorUrl.searchParams.set("error", "tenant-access-check-failed");
      return NextResponse.redirect(errorUrl);
    }

    const decision = resolveLoginAccess({
      access,
      savedOrganizationId: request.cookies.get("cervise_org")?.value ?? null,
    });

    if (decision.kind === "denied") {
      // Sesi lama juga harus dihentikan, bukan cuma dialihkan. Cookie hasil
      // signOut ditulis ke response redirect supaya browser benar-benar logout.
      try {
        await supabase.auth.signOut();
      } catch {
        // Tetap tolak akses walau penghapusan sesi gagal.
      }
      const deniedUrl = new URL("/login", request.url);
      deniedUrl.searchParams.set("error", decision.reason);
      const deniedResponse = NextResponse.redirect(deniedUrl);
      response.cookies.getAll().forEach((cookie) => deniedResponse.cookies.set(cookie));
      return deniedResponse;
    }

    const destination = decision.destination;

    if (destination === "/owner" && !pathname.startsWith("/owner")) {
      return NextResponse.redirect(new URL(destination, request.url));
    }
    if (destination === "/onboarding" && !pathname.startsWith("/onboarding")) {
      return NextResponse.redirect(new URL(destination, request.url));
    }
    if (destination === "/dashboard/tenant" && protectedPathKind !== "tenant") {
      return NextResponse.redirect(new URL(destination, request.url));
    }
    if (destination === "/account/assignment-required" && !pathname.startsWith(destination)) {
      return NextResponse.redirect(new URL(destination, request.url));
    }
    if (destination === "/app" && protectedPathKind === "tenant") {
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
