import "server-only";

import { cookies } from "next/headers";
import { translate, type Lang } from "./dict";

/** Current UI language from the `gwg_lang` cookie (server components). */
export async function getLang(): Promise<Lang> {
  const c = await cookies();
  return ((c.get("gwg_lang")?.value as Lang) || "en") satisfies Lang;
}

/** A `t(key)` bound to the request's language, for server components. */
export async function getT(): Promise<(key: string) => string> {
  const lang = await getLang();
  return (key: string) => translate(lang, key);
}
