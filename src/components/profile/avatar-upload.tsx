"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { uploadMyAvatarAction } from "@/lib/actions/avatar";

/** Profile photo with tap-to-upload — available to every user. */
export function AvatarUpload({ name, src, size = 64 }: { name: string; src?: string | null; size?: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadMyAvatarAction(fd);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Foto profil diperbarui");
    router.refresh();
  }

  return (
    <label className="relative inline-block cursor-pointer" style={{ width: size, height: size }} title="Ubah foto profil">
      <Avatar name={name} src={src} size={size} />
      <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-card">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
      </span>
      <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
    </label>
  );
}
