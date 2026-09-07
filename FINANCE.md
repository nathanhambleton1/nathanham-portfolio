# Finance (NexaFi) — `/finance`

The NexaFi personal-finance app, ported from its standalone Python/FastAPI
repository into this site as a password-gated sub-app.

Source lives in [`src/finance/`](src/finance). It is lazy-loaded from
[`src/pages/Finance.tsx`](src/pages/Finance.tsx), so visitors who never open
`/finance` don't download it.

---

## One-time setup

### 1. Create the owner account in Supabase

Dashboard → Authentication → Users → **Add user**:

- Email: `nhambleton03@gmail.com`
- Password: the one you want to type at `/finance`
- Auto-confirm the user

Then Authentication → Providers → Email: **turn public sign-ups OFF**. This is
load-bearing. The gate has no email field because sign-in always targets this one
account; if anyone could create an account, they'd get an `authenticated` session
too.

### 2. Create the tables

Run [`supabase/finance_setup.sql`](supabase/finance_setup.sql) in the SQL
editor. It creates 28 `fin_*` tables, enables row-level security on each, revokes
`anon`, and adds an `owner = auth.uid()` policy.

### 3. Import your existing data

```bash
python3 scripts/migrate-nexafi-sqlite.py \
  --database ~/Library/Application\ Support/NexaFi/data/nexafi.db \
  --owner-email nhambleton03@gmail.com \
  --out supabase/finance_migrate_data.sql
```

Run the generated file in the SQL editor **after** step 2. It resolves your user
id by email, inserts every row with its original id (the foreign keys depend on
that), and resyncs the identity sequences at the end.

The already-generated file covers the current local database: 98 rows — 7
accounts, 22 categories, 9 transactions, 33 settings, 5 goals, 7 recurring
expenses, 1 sinking fund, 6 monthly snapshots, 1 retirement contribution.

### 4. Build with Supabase credentials

`src/lib/supabase.ts` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
Copy [`.env.example`](.env.example) to `.env`. Without them the client points
at an empty URL and every query fails — this affects `/travel` too.

---

## Why the data is safe on a public site

The anon key in the bundle is public by design and grants nothing on its own.
Three layers sit behind it:

1. Every `fin_*` table has `revoke all ... from anon`. An unauthenticated request
   reads zero rows regardless of what the UI does.
2. Every policy is `owner = auth.uid()`, so even a second Supabase account would
   see nothing.
3. Sign-ups are disabled, so no second account can exist.

The password box is a real `signInWithPassword`, not a client-side string
comparison — you cannot skip it from devtools.

---

## What is identical to the Python

All 22 pages, the same URLs under `/finance`, the same stylesheet (scoped to
`.finance-root`), and the same deterministic engine:

- `planning.ts` — progressive federal/Virginia brackets, FICA with the wage-base
  cap and additional-Medicare threshold, retirement projection, goal forecasting,
  the surplus waterfall, house glide path
- `allocation.ts` — the money-flow engine: obligations, per-paycheck earmarking,
  real transfers, month close/reopen/replan
- `imports.ts` / `importSchema.ts` — staged imports, duplicate and transfer
  detection, merchant rules, recurring-change suggestions
- `investments.ts`, `finance.ts`, `paychecks.ts`, `ai.ts`, `exports.ts`, `setup.ts`

Money uses `decimal.js` with ROUND_HALF_UP rather than JS floats, because the
original's promise of deterministic figures depends on exact decimal arithmetic.

**Verified**: 194 computed values across 21 function groups were compared
against the Python originals running on identical inputs. Every value matched.

---

## What deliberately changed

Four things could not port as-is. Each is called out in the relevant file.

| Was | Now | Why |
|---|---|---|
| SQLite file on one laptop | Supabase Postgres | Nothing to serve from a static site; this also syncs across devices |
| Local `.db` backups, portable `.zip`, "Open Data Folder", backup schedule | Full JSON export + JSON restore (Data & Backup) | No local file, no filesystem access, no background process. Supabase keeps managed backups; the JSON export is the copy you hold |
| One-click AI commentary / extraction via a server-held API key | Copy-prompt / paste-JSON, validated against the same schema | A key in a public bundle is readable *and billable* by anyone. The original already treated manual mode as fully supported |
| Plotly charts | Recharts | Already a dependency here. Same palette; see below |

### Chart palette note

The Plotly donut assigned `#8f8e87` next to `#b99345` — a pair only ΔE 10.4
apart for normal vision, effectively indistinguishable as neighbouring slices,
and it had `textinfo="none"` so slice identity was carried by colour alone.

The same five brand colours are kept, reordered so no weak pair is adjacent
(worst neighbouring pair is now ΔE 18.5, and 17.5 under protanopia), and every
slice is named and valued in a legend. Gold and pale gold also fall below 3:1
against the card, so visible labels were required regardless.

---

## Retiring the old repository

Safe to delete `nexafi/` once you have:

- [ ] Run `finance_setup.sql` and `finance_migrate_data.sql`
- [ ] Signed in at `/finance` and confirmed your accounts, balances, goals and
      settings look right
- [ ] Downloaded a full JSON backup from **Data & Backup** and stored it
      somewhere other than this machine
- [ ] Kept a copy of `~/Library/Application Support/NexaFi/data/nexafi.db`
      somewhere safe — it is the only copy of the pre-migration state
