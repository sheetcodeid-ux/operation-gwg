"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";
import { getUser } from "@/lib/data/store";
import { verifyCredentials } from "@/lib/data/credentials";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

/** Demo sign-in: persist the chosen persona id in a session cookie. */
export async function signInAsDemo(userId: string) {
  if (!getUser(userId)) return { error: "Unknown user" };
  const store = await cookies();
  store.set(SESSION_COOKIE, userId, COOKIE_OPTS);
  redirect("/dashboard");
}

/** Username (email) + password sign-in. Supabase when live, credential store in demo. */
export async function signInWithPassword(_prev: { error?: string } | null, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) return { error: "Enter your username and password." };

  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { error } = (await supabase?.auth.signInWithPassword({ email: username, password })) ?? {
      error: { message: "Auth unavailable" },
    };
    if (error) return { error: error.message };
    redirect("/dashboard");
  }

  const result = verifyCredentials(username, password);
  if (!result.ok) {
    return {
      error: result.reason === "inactive" ? "This account is inactive. Contact your administrator." : "Invalid username or password.",
    };
  }
  const store = await cookies();
  store.set(SESSION_COOKIE, result.userId, COOKIE_OPTS);
  redirect("/dashboard");
}

export async function signOut() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    await supabase?.auth.signOut();
  }
  redirect("/login");
}
