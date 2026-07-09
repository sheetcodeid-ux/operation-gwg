"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Pencil, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteUserAction } from "@/lib/actions/users";
import {
  AccessPanel,
  AssignRolesPanel,
  UserFormPanel,
  type OutletLite,
  type UserRow,
} from "@/components/admin/user-manager";

/** Manage actions on the user detail page — reuses the list's slide-over panels. */
export function UserDetailActions({ user, outlets }: { user: UserRow; outlets: OutletLite[] }) {
  const router = useRouter();
  const [panel, setPanel] = React.useState<null | "edit" | "roles" | "access">(null);
  const [pending, start] = React.useTransition();
  const close = () => setPanel(null);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setPanel("edit")}>
          <Pencil className="size-4" /> Edit
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPanel("roles")}>
          <Shield className="size-4" /> Assign Roles
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPanel("access")}>
          <KeyRound className="size-4" /> Hak Akses
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          className="border-red-500/40 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
          onClick={() => {
            if (typeof window !== "undefined" && !window.confirm(`Hapus pengguna "${user.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
            start(async () => {
              const res = await deleteUserAction(user.id);
              if (res?.error) toast.error(res.error);
              else {
                toast.success("Pengguna dihapus");
                router.push("/admin/users");
              }
            });
          }}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Hapus
        </Button>
      </div>

      {panel === "edit" && <UserFormPanel mode="edit" user={user} outlets={outlets} onClose={close} />}
      {panel === "roles" && <AssignRolesPanel user={user} onClose={close} />}
      {panel === "access" && <AccessPanel user={user} onClose={close} />}
    </>
  );
}
