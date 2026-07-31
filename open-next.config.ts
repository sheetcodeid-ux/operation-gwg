import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext → Cloudflare Workers adapter config.
 *
 * Default (no incremental cache) keeps the deploy simple: every route in this
 * app is already `dynamic`/server-rendered, so there's no ISR cache to persist.
 * If we later add static/ISR pages, wire an R2 incremental cache here.
 */
export default defineCloudflareConfig();
