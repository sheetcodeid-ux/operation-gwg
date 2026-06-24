import { Mail, ShieldCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { areaName, visibleOutlets } from "@/lib/data/store";
import { ROLE_LABEL } from "@/lib/constants";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ChangePasswordForm } from "@/components/profile/change-password";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = (await getSessionUser())!;
  const outlets = visibleOutlets(user);
  const scope =
    user.role === "area_coordinator" && user.areaId
      ? `${outlets.length} outlets · ${areaName(user.areaId)}`
      : user.role === "supervisor" || user.role === "pic_outlet"
        ? `${outlets.length} outlet`
        : "All outlets";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader icon={UserRound} title="My Profile" description="Your account details and security" />

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} size={64} />
            <div className="min-w-0">
              <p className="text-lg font-semibold text-foreground">{user.name}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="size-3.5" /> {user.email}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="brand">{ROLE_LABEL[user.role]}</Badge>
                <Badge tone="neutral">{scope}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-500" /> Security
          </CardTitle>
          <CardDescription>Change your account password.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
