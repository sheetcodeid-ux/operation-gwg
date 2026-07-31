# Deploy to Cloudflare (Workers) — Runbook

The app now runs on **Cloudflare Workers** via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)
instead of Vercel. Everything in the codebase is ready; the steps below need
your **Cloudflare account** and only have to be done once.

## What changed in the repo
- `wrangler.jsonc` — Workers config (nodejs_compat, static assets, daily cron).
- `open-next.config.ts` — the OpenNext → Cloudflare adapter.
- `next.config.ts` — added `initOpenNextCloudflareForDev()` (dev-only, gives
  `next dev` the same bindings as Workers).
- `package.json` — new scripts: `cf:build`, `cf:preview`, `cf:deploy`, `cf:typegen`.
- **Removed** `src/proxy.ts` — Next 16's proxy runs Node-only and Cloudflare
  can't run it. Its two jobs are now server-side: the unauthenticated → `/login`
  gate lives in `(app)/layout.tsx`, and the already-signed-in → `/dashboard`
  redirect lives in `(auth)/login/page.tsx`.
- **Removed** `vercel.json` — its daily fraud-sync cron is now a Cloudflare Cron
  Trigger in `wrangler.jsonc` (`30 21 * * *`). The Supabase pg_cron hourly job
  is unaffected (it just needs the new URL — see step 5).
- Bumped `next` 16.2.9 → 16.2.12 (required by the adapter).

## One-time deploy steps (needs your Cloudflare login)

### 1. Log in
```bash
npx wrangler login          # opens a browser; authorize the account/team
# — or, for CI / headless — set an API token:
#   export CLOUDFLARE_API_TOKEN=...    (Workers Scripts:Edit + Workers R2:Edit)
#   export CLOUDFLARE_ACCOUNT_ID=...
```

### 2. Set the secrets (the env vars the app reads via `process.env`)
Run each and paste the value when prompted:
```bash
npx wrangler secret put GWG_SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx wrangler secret put R2_ENDPOINT
npx wrangler secret put R2_BUCKET
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put ESB_BASE_URL
npx wrangler secret put ESB_USERNAME
npx wrangler secret put ESB_PASSWORD
npx wrangler secret put GWGMANAGE_BASE_URL
npx wrangler secret put GWGMANAGE_EMAIL
npx wrangler secret put GWGMANAGE_PASSWORD
npx wrangler secret put CRON_SECRET
```
> `NEXT_PUBLIC_*` values are also baked into the client bundle at **build time**,
> so make sure they're present in the shell env when you run `cf:deploy` too
> (put them in a local `.env` or export them before building).

### 3. Deploy
```bash
npm run cf:deploy
```
This builds the Worker and uploads it. It prints the live URL
(`https://operation-gwg.<subdomain>.workers.dev`).

### 4. Point the domain
In the Cloudflare dashboard → **Workers & Pages → operation-gwg → Settings →
Domains & Routes**, add your custom domain (e.g. `operation.gwg.co.id`). If the
domain's DNS is already on Cloudflare this is a couple of clicks; otherwise move
the domain's nameservers to Cloudflare first.

### 5. Repoint the Supabase hourly cron
The `pg_cron` job that calls `/api/cron/fraud-sync?token=…` still points at the
old Vercel URL. Update it to the new Workers URL (Supabase → Database → Cron, or
the `app_config` row that stores the base URL).

### 6. Turn off Vercel
Once the Cloudflare URL serves the app, pause/delete the Vercel project so it
stops receiving traffic and can't double-run the cron.

## Local development
- `npm run dev` — normal Next dev (now with Cloudflare bindings via OpenNext).
- `npm run cf:preview` — build + run the **real Worker** locally in workerd
  (closest thing to production; good for a final smoke test before deploy).

## Notes / limits
- Worker upload is ~3.7 MB gzip — within the Workers limit.
- Server Actions accept up to 12 MB bodies (unchanged) — fine on Workers.
- R2 uploads use `aws4fetch` (already Workers-native), no change needed.
