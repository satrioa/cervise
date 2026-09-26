import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";
import { resolvePostLoginDestination } from "./src/lib/auth/post-login";
import { getProtectedPathKind } from "./src/lib/auth/authorization";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // Supabase session refresh
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
  await supabase.auth.getUser();

  // Run next-intl after supabase to preserve locale handling
  const intlResponse = intlMiddleware(request) as NextResponse;
  // merge intl headers/cookies into supabase response if needed
  if (intlResponse) {
    intlResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") return;
      response.headers.set(key, value);
    });
  }

  const { data: auth } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  const protectedPathKind = getProtectedPathKind(pathname);

  if (protectedPathKind && !auth.user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (auth.user && protectedPathKind) {
    const [platformAdminResult, employeesResult] = await Promise.all([
      supabase
        .from("platform_admins")
        .select("profile_id")
        .eq("profile_id", auth.user.id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("employees")
        .select("organization_id, role")
        .eq("profile_id", auth.user.id)
        .eq("is_active", true),
    ]);

    if (platformAdminResult.error || employeesResult.error) {
      const errorUrl = new URL("/login", request.url);
      errorUrl.searchParams.set("error", "tenant-access-check-failed");
      return NextResponse.redirect(errorUrl);
    }

    const destination = resolvePostLoginDestination({
      isPlatformAdmin: Boolean(platformAdminResult.data),
      savedOrganizationId: request.cookies.get("cervise_org")?.value ?? null,
      memberships: (employeesResult.data ?? []).map((employee) => ({
        organizationId: employee.organization_id as string,
        role: employee.role as string,
      })),
    });

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
