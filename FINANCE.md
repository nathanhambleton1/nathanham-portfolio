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

The already-generated file covers the current local database: 89 rows — 7
accounts, 22 categories, 33 settings, 5 goals, 7 recurring expenses, 1 sinking
fund, 6 monthly snapshots, 1 retirement contribution. The source database's 9
transactions were all filler entered while first setting up NexaFi (source =
'demo') and were intentionally left out.

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

## The pages

The app was reworked down from 22 pages to 9. What survived maps to the four
things it is actually used for.

| Page | What it is for |
|---|---|
| **Money Flow** (`/finance`) | Decide a month. Bills come off the top automatically; the leftover is split by hand across savings buckets, with suggested amounts pre-filled |
| **Bills** | Every fixed cost — recurring expenses and subscriptions as one list |
| **Savings & Goals** | The buckets, and what each account's balance is actually made of |
| **Paychecks** | Pay history and corrections |
| **Accounts** | Balances, the ledger, and the category split (was three pages) |
| **Import** | Staged document imports |
| **Taxes** | Withholding and the refund estimate |
| **Reports** | Monthly snapshots, exports, and restore |
| **Settings** | The assumptions the math reads |

Removed: Setup, Dashboard, Transactions, Spending, Goals, Sinking Funds,
Investments, Retirement, Financial Health, AI Insights, Needs Review, and
Data & Backup. **No table was dropped** — every row is still loaded, still
exported by the full JSON backup, and still restorable. Only the pages went.

## How a month works now

The original earmarked everything automatically the moment a paycheck landed:
bills, card statements, sinking funds and goals all in one priority-ordered
waterfall. That is right for the bills and wrong for the rest — in a tight month
"all of it into the emergency fund, none into travel" is a judgement, not a
calculation.

So a month has two halves:

```
net pay
  − bills, reserved in checking      ← automatic, priority order, stops when the money stops
  = available
      − savings buckets              ← you decide, every month, in the editor
  = left to spend                    ← imported transactions draw this down
```

`allocation.ts` owns the first half (`billObligations`, `allocatePaycheck`) and
suggests the second (`bucketTargets`). `monthplan.ts` owns the decision:
`monthPlanView` builds the editor, `saveMonthPlan` records it.

Saving **rewrites** the month rather than patching it. Every allocation row for
the month is reverted — envelope credits backed out, transfers deleted, balances
restored — and written again from the amounts on screen. That is what makes
opening a month you skipped three months ago safe: there is no incremental state
to get wrong, only the final answer.

A month is edited as a whole, anchored on its last paycheck (the allocations
table requires one). Every other paycheck in the month gets an empty marker row,
without which the next auto-sync would see them as unplanned and reserve the
bills a second time.

## What is identical to the Python

The same deterministic engine underneath:

- `planning.ts` — progressive federal/Virginia brackets, FICA with the wage-base
  cap and additional-Medicare threshold, retirement projection, goal forecasting
- `allocation.ts` — obligations, per-paycheck earmarking, real transfers, month
  close/reopen (the bucket half now defers to `monthplan.ts`)
- `imports.ts` / `importSchema.ts` — staged imports, duplicate and transfer
  detection, merchant rules, recurring-change suggestions
- `finance.ts`, `paychecks.ts`, `exports.ts`

Money uses `decimal.js` with ROUND_HALF_UP rather than JS floats, because the
original's promise of deterministic figures depends on exact decimal arithmetic.

## What deliberately changed

Four things could not port as-is. Each is called out in the relevant file.

| Was | Now | Why |
|---|---|---|
| SQLite file on one laptop | Supabase Postgres | Nothing to serve from a static site; this also syncs across devices |
| Local `.db` backups, portable `.zip`, "Open Data Folder", backup schedule | Full JSON export + JSON restore (Reports) | No local file, no filesystem access, no background process. Supabase keeps managed backups; the JSON export is the copy you hold |
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
- [ ] Signed in at `/finance` and confirmed your accounts, balances, buckets and
      settings look right
- [ ] Downloaded a full JSON backup from **Reports** and stored it somewhere
      other than this machine
- [ ] Kept a copy of `~/Library/Application Support/NexaFi/data/nexafi.db`
      somewhere safe — it is the only copy of the pre-migration state
