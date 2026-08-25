# Making changes save to the database

If a password change, a new user, or an edited asset does not show up on another
phone or browser, work through this page in order.

---

## What was wrong

The app signed users in locally — it never called Supabase's own sign-in. Every
request therefore reached the database as the **`anon`** role, while all 55 row
level security policies in `02_rls_policies.sql` were written `TO authenticated`.

The result:

| Operation | What actually happened |
| --- | --- |
| Reading a list | Returned zero rows, so the app fell back to its built-in demo data |
| Saving anything | Rejected by RLS, no error thrown by PostgREST |
| The UI | Showed success, because every write was wrapped in `catch (e) {}` |

So changes only ever lived in that one browser's `localStorage`. Opening the site
on a phone showed the original demo data, and a changed password did not work.

Three smaller faults compounded it:

- `profiles.id` had a foreign key to `auth.users(id)`, so app-created users could
  never be inserted.
- `profiles` had no `password` and no `employee_id` column, so those updates
  failed with `PGRST204`.
- New records were given ids like `ast-1724889…`, which Postgres rejects as
  invalid UUIDs (`22P02`).

---

## Step 1 — Run the database fix

Supabase Dashboard → **SQL Editor** → **New query** → paste the whole of
`database/05_cloud_sync_fix.sql` → **Run**.

It is safe to re-run, and it never overwrites a password you have already
changed.

If you have never set the database up at all, run the files in order first:
`01_schema.sql`, `02_rls_policies.sql`, `03_triggers_and_functions.sql`,
`04_seed_data.sql`, then `05_cloud_sync_fix.sql`.

The query ends by printing three numbers. All three must be above zero:

```
profiles in cloud        5
accounts with password   5
tables opened to app     26
```

## Step 1b — Create any tables your database is missing

If the `tables opened to app` number came back lower than 26, your database is
missing tables — the app had nowhere to write those records.

Run `database/06_create_missing_tables.sql` next. It creates **only** what is
absent and never drops or empties an existing table, so the accounts and
passwords from step 1 survive.

It creates **no buildings, floors, locations, assets, work orders or PPM
plans** — you add those in the app and they save to the cloud for everyone.
Those tables start empty.

It does seed the reference data the app has no screen for, because without it
every dropdown is empty and nothing can be created at all:

| Seeded | Why it has to be |
| --- | --- |
| Categories, Subcategories | Picked when adding an asset or work order; no UI to create them |
| SLA levels | `work_orders.priority` points at this table — work orders cannot save without it |
| PPM checklists | Every PPM plan must reference one |
| Materials | The Materials page is read-only, so stock has to be inserted here |

Each block runs only if that table is empty, so re-running changes nothing.

**Never run `01_schema.sql` to fix missing tables.** It starts with
`DROP TABLE ... CASCADE` and would delete your accounts.

Expect `tables the app can reach` to read **26** and `still missing` to read
**none**.

> After this, Buildings, Assets and Work Orders will look **empty** in the app.
> That is correct — the lists you saw before were demo records built into the
> JavaScript bundle, never real data. From now on what you see is what is
> actually in the database.
>
> Start by adding a building under **Facilities**, then its floors and
> locations, then assets. Everything you create is stored in the cloud and
> visible to every other user straight away.

### If the migration reports an error

Run `database/00_inspect_schema.sql` first — it is read-only and prints the real
column types, policies and functions in your database. Deployed databases have
been seen to differ from `01_schema.sql` (for example `profiles.id` being `TEXT`
rather than `UUID`), and that output shows exactly how.

`05_cloud_sync_fix.sql` detects the type of `profiles.id` and builds the
credentials table, the foreign key and the seed inserts to match, so both
variants work without editing anything.

## Step 2 — Check the keys are set on Vercel

Vercel → your project → **Settings** → **Environment Variables**. Both of these
must exist, for **Production**:

| Name | Where to find it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → Project API keys → `anon` `public` |

These are read at **build time**, not at run time. After adding or changing them
you must **redeploy** — Deployments → latest → ⋯ → Redeploy. Saving the variable
alone changes nothing.

If they are missing, the site runs against a placeholder URL and the app now
shows an amber banner saying so.

## Step 3 — Prove it works

From the project folder:

```bash
node scripts/verify-cloud-sync.mjs https://YOUR-PROJECT.supabase.co YOUR-ANON-KEY
```

It writes a throwaway row, reads it back, and deletes it. Your real data is not
touched. Every line should say `PASS`.

## Step 4 — Test on the site

1. Open the deployed site, sign in as `admin@shever.com` / `Password123!`
2. **Users** → key icon on any account → set a new password → Save
3. Open the site on your phone (or a private window) and sign in with the new
   password

It should work. If it does not, the banner at the top of the page now names the
exact database error instead of failing quietly.

---

## Default accounts

All start with the password `Password123!`. Change the admin password
immediately after the first sign-in.

| Email | Employee ID | Role |
| --- | --- | --- |
| `admin@shever.com` | EMP-101 | Administrator |
| `manager@shever.com` | EMP-102 | FM Manager |
| `supervisor@shever.com` | EMP-103 | Supervisor |
| `technician@shever.com` | EMP-104 | Technician |
| `tech.elec@shever.com` | EMP-105 | Technician |

---

## How passwords are stored now

Passwords are **bcrypt-hashed** and kept in a `user_credentials` table that the
browser cannot read at all — it has row level security on and no policies, so
only the `SECURITY DEFINER` functions can reach it.

- Signing in calls `app_login(identifier, password)`, which checks the hash in
  the database and returns the profile only on a match.
- Changing a password calls `app_set_password(user_id, password)`.

The browser never receives a password hash, and plaintext passwords are no
longer written to `localStorage`.

## A security limitation worth knowing about

Because the app authenticates itself rather than using Supabase Auth, the anon
key must be allowed to read and write the data tables. That key ships inside the
JavaScript bundle, so anyone who opens developer tools on the site can read and
modify **operational data** — work orders, assets, buildings, materials. Login
credentials are not exposed, but the rest is.

For an internal tool behind a known URL this is often accepted. To close it
properly, move to real Supabase Auth: create an `auth.users` record per staff
member, call `supabase.auth.signInWithPassword()` at login, and restore the
`TO authenticated` policies from `02_rls_policies.sql`. That is a larger change
and is worth planning separately.
