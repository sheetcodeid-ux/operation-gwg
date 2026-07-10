import type { UserProfile } from "@/lib/types";
import { canOpenMenu } from "@/lib/nav";

/** Who may use HPP (create/edit/submit): R&D roles, admin, grants, or anyone in
 *  the R&D / Food & Beverage department. */
export function canUseHpp(user: UserProfile | null): user is UserProfile {
  if (!user) return false;
  return canOpenMenu(user.role, "hpp", user.grants) || user.department === "R&D" || user.department === "Food & Beverage";
}

/** Who may verify/reject a menu: only the R&D Head (head_bar_rnd) or Super Admin.
 *  Other F&B/R&D members can draft & submit, but not approve their own work. */
export function canVerifyHpp(user: UserProfile | null): user is UserProfile {
  if (!user) return false;
  return user.role === "super_admin" || user.role === "head_bar_rnd";
}
