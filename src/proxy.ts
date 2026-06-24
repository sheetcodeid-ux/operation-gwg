import { NextResponse, type NextRequest } from "next/server";

/**
 * Next 16 Proxy (formerly Middleware). Optimistic auth gate only — full
 * authorization happens in server components via `getSessionUser()`.
 *
 * Demo mode keys off the `gwg_uid` cookie; Supabase mode keys off the
 * `sb-*-auth-token` cookies set by @supabase/ssr.
 */
const PUBLIC_PATHS = ["/login"];

function hasSession(req: NextRequest): boolean {
  if (req.cookies.get("gwg_uid")) return true;
  for (const c of req.cookies.getAll()) {
    if (c.name.startsWith("sb-") && c.name.includes("auth-token")) return true;
  }
  return false;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const authed = hasSession(req);

  // Unauthenticated users hitting a protected route -> login
  if (!authed && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated users hitting login -> dashboard
  if (authed && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
