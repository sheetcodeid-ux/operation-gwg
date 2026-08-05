import { redirect } from "next/navigation";

/** Rute lama — fitur ini sekarang hidup di /pengajuan. */
export default function HcRequestRedirect() {
  redirect("/pengajuan");
}
