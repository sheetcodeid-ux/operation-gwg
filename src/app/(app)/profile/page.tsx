import { Mail, ShieldCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { visibleOutlets } from "@/lib/data/store";
import { hasGlobalScope } from "@/lib/rbac";
import { ROLE_LABEL } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ChangePasswordForm } from "@/components/profile/change-password";
import { AvatarUpload } from "@/components/profile/avatar-upload";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireSessionUser();
  const outlets = visibleOutlets(user);
  // Show the user's actual outlet coverage — "All outlets" only for HQ roles.
  const scope = hasGlobalScope(user.role)
    ? "All outlets"
    : outlets.length === 0
      ? "—"
      : outlets.length <= 2
        ? outlets.map((o) => o.name).join(", ")
        : `${outlets.length} outlets`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader icon={UserRound} title="My Profile" description="Your account details and security" />

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-4">
            <AvatarUpload name={user.name} src={user.avatarUrl} size={64} />
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
