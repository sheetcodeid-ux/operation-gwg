import type { UserProfile } from "@/lib/types";
import { canOpenMenu } from "@/lib/nav";

/** Who may view/input Operation Finance data (Beban Operasional & Pembelian):
 *  Operation/Finance department, Super Admin, or anyone granted the menu. */
export function canUseOpsFinance(user: UserProfile | null): user is UserProfile {
  if (!user) return false;
  return (
    user.role === "super_admin" ||
    user.department === "Operation" ||
    user.department === "Finance" ||
    canOpenMenu(user.role, "op_beban", user.grants)
  );
}
