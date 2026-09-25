import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // Supabase session refresh
  let response = NextResponse.next({ request: { headers: request.headers } });
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
  await supabase.auth.getUser();

  // Run next-intl after supabase to preserve locale handling
  const intlResponse = intlMiddleware(request as any) as NextResponse;
  // merge intl headers/cookies into supabase response if needed
  if (intlResponse) {
    intlResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") return;
      response.headers.set(key, value);
    });
  }

  const { data: auth } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Guard /app/* and /dashboard/tenant/* -> redirect to /login if not auth (do not resolve tenant here)
  if ((pathname.startsWith("/app") || pathname.startsWith("/dashboard/tenant")) && !auth.user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated and no tenant (no employees row), force to /onboarding for setup
  // 1 user can have N tenants, creator = MASTER_ADMIN. Dashboard requires tenant.
  if (auth.user && (pathname.startsWith("/app") || pathname.startsWith("/dashboard/tenant"))) {
    const { data: emps } = await supabase
      .from("employees")
      .select("id")
      .eq("profile_id", auth.user.id)
      .eq("is_active", true)
      .limit(1);
    if (!emps || emps.length === 0) {
      const onboardingUrl = new URL("/onboarding", request.url);
      // avoid loop: don't redirect if already on /onboarding or /owner
      if (pathname !== "/onboarding" && !pathname.startsWith("/onboarding") && pathname !== "/owner" && !pathname.startsWith("/owner/") && pathname !== "/dashboard/tenant" && !pathname.startsWith("/dashboard/tenant/")) {
        return NextResponse.redirect(onboardingUrl);
      }
      if (pathname === "/dashboard/tenant" || pathname.startsWith("/dashboard/tenant/")) {
        // let the page handle redirect, don't force to avoid loop
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
