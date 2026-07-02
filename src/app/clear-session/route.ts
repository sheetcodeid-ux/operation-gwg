import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/** Clears EVERY session cookie (signed gwg_uid AND Supabase sb-* tokens) then
 *  sends the visitor to login. The proxy treats any of those cookies as "has a
 *  session", so leaving a stale sb-* cookie behind causes a redirect loop. */
export async function GET(req: Request) {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  for (const c of store.getAll()) {
    if (c.name.startsWith("sb-")) store.delete(c.name);
  }
  return NextResponse.redirect(new URL("/login", req.url));
}
