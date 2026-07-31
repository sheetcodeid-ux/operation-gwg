import type { NextConfig } from "next";

/**
 * Security headers applied to every response. Tightens the app against
 * clickjacking (frame-ancestors/X-Frame-Options), MIME sniffing, protocol
 * downgrade (HSTS), and referrer/permission leakage.
 *
 * NOTE: the CSP intentionally allows 'unsafe-inline' for styles (Tailwind +
 * next-themes inline the initial theme) and connects to Supabase. Tighten the
 * script-src with a nonce once a nonce pipeline is in place.
 */
const isProd = process.env.NODE_ENV === "production";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // Next injects small inline bootstrap scripts; 'unsafe-inline' needed until a nonce is wired.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.r2.cloudflarestorage.com",
  // Training video/audio streamed from R2 (E-Learning) — <video>/<audio> use media-src.
  "media-src 'self' blob: https://*.r2.cloudflarestorage.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.r2.cloudflarestorage.com",
  "frame-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  experimental: {
    // Hygiene/Hospitality documentation uploads several timestamped camera
    // photos per request; the default 1 MB Server Action body limit would 413.
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

// Give `next dev` access to the Cloudflare bindings/vars (via getCloudflareContext)
// so local dev matches the Workers runtime. No-op in production builds.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
void initOpenNextCloudflareForDev();
