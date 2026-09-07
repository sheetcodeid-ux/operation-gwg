/** Tiruan `next/link`: cukup anchor biasa supaya bundel pratinjau tidak
 *  menarik runtime Next. */
import type { AnchorHTMLAttributes } from "react";

export default function Link({ href, children, ...sisa }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href} {...sisa}>{children}</a>;
}
