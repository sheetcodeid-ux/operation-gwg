# Supabase Integration (Phase 11)

The app ships in **demo mode** (seeded in-memory data + cookie-based role switching) so it runs
with zero configuration. This folder contains everything needed to switch to **live Supabase**
(Postgres + Auth + Storage) without changing any UI code.

## What's here

| File | Purpose |
| --- | --- |
| `migrations/0001_init.sql` | Tables, enums, indexes, new-user → `profiles` trigger. Mirrors `src/lib/types.ts`. |
| `migrations/0002_rls.sql` | Row Level Security. Mirrors `src/lib/rbac.ts` scoping (global / area / outlet). |
| `migrations/0003_storage.sql` | `attachments` + `hygiene-photos` buckets with per-user upload policies. |

## Switch from demo → live

1. **Create a Supabase project** and grab the URL + anon key.
2. **Set env** (`.env.local`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
   ```
   The moment these are present, `src/lib/supabase/env.ts#isSupabaseConfigured` flips to `true`:
   - `getSessionUser()` resolves the real authenticated user (`auth.ts`).
   - `proxy.ts` gates on the `sb-*-auth-token` cookies.
   - `signInWithPassword` (`lib/actions/auth.ts`) uses Supabase Auth.
3. **Run migrations**:
   ```
   supabase link --project-ref YOUR-REF
   supabase db push
   ```
4. **Port the data layer.** Reimplement the read functions in `src/lib/data/store.ts` and the
   writes in `src/lib/data/mutations.ts` against Supabase. Signatures and derived-score logic stay
   identical — only the bodies change. Example:
   ```ts
   export async function listComplaints(user: UserProfile) {
     const supabase = await createSupabaseServerClient();
     const { data } = await supabase!.from("complaints").select("*").order("created_at", { ascending: false });
     return data ?? []; // RLS already scopes rows to the user
   }
   ```
   Because RLS enforces scoping server-side, the explicit `scopeOutlets` filtering becomes a
   defense-in-depth second layer rather than the primary gate.

## Notes
- Column names are `snake_case` in Postgres; map to the `camelCase` domain types in the adapter.
- `scores` / `ratings` / `attachments` / `corrective_action` are `jsonb` — they round-trip the same
  shapes the UI already uses.
- The `handle_new_user` trigger creates a `profiles` row on signup; an admin then assigns role +
  area/outlet scope from **Admin → User Management**.
