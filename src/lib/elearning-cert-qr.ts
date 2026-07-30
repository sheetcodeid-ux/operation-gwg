import "server-only";

import QRCode from "qrcode";
import { headers } from "next/headers";

/** Build the public verification URL for a certificate number + its QR data URI. */
export async function certVerifyQr(number: string): Promise<{ verifyUrl: string; qrDataUrl: string }> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const verifyUrl = `${proto}://${host}/elearning/verify/${encodeURIComponent(number)}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 240, errorCorrectionLevel: "M" });
  return { verifyUrl, qrDataUrl };
}
