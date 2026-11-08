-- Snapshot of the live Supabase `public` schema (project kcyrvubzhsphpxfsewii),
-- taken 2026-11-07 straight from the database: tables, constraints, RLS flags,
-- views, indexes, functions, triggers and policies. Grants are not included.
--
-- This is a backup/reference, not a migration: the per-feature files in this
-- folder are the source of truth. Re-generate it by running the catalog query
-- in the commit that added this file (pg_get_functiondef / pg_get_constraintdef
-- / pg_policies) and replacing this file.
--
-- Note: taken BEFORE supabase/drunkopoly_site_analytics.sql's second part
-- (source/username/admin-only columns and functions) was applied.

create table if not exists public.blackjack_actions (
  id uuid not null default gen_random_uuid(),
  game_id uuid not null,
  round_id uuid,
  player_id uuid,
  hand_id uuid,
  action_type text not null,
  card text,
  amount integer,
  details jsonb,
  sequence_number integer,
  created_at timestamp with time zone not null default now(),
  constraint blackjack_actions_pkey PRIMARY KEY (id),
  constraint blackjack_actions_game_id_fkey FOREIGN KEY (game_id) REFERENCES blackjack_games(id) ON DELETE CASCADE,
  constraint blackjack_actions_hand_id_fkey FOREIGN KEY (hand_id) REFERENCES blackjack_hands(id) ON DELETE CASCADE,
  constraint blackjack_actions_player_id_fkey FOREIGN KEY (player_id) REFERENCES blackjack_players(id) ON DELETE CASCADE,
  constraint blackjack_actions_round_id_fkey FOREIGN KEY (round_id) REFERENCES blackjack_rounds(id) ON DELETE CASCADE
);
alter table public.blackjack_actions enable row level security;

create table if not exists public.blackjack_chip_requests (
  id uuid not null default gen_random_uuid(),
  game_id uuid not null,
  player_id uuid not null,
  amount integer not null,
  status text not null default 'pending'::text,
  handled_by uuid,
  handled_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint blackjack_chip_requests_pkey PRIMARY KEY (id),
  constraint blackjack_chip_requests_game_id_fkey FOREIGN KEY (game_id) REFERENCES blackjack_games(id) ON DELETE CASCADE,
  constraint blackjack_chip_requests_handled_by_fkey FOREIGN KEY (handled_by) REFERENCES blackjack_players(id),
  constraint blackjack_chip_requests_player_id_fkey FOREIGN KEY (player_id) REFERENCES blackjack_players(id) ON DELETE CASCADE
);
alter table public.blackjack_chip_requests enable row level security;

create table if not exists public.blackjack_games (
  id uuid not null default gen_random_uuid(),
  code text not null,
  name text default 'Blackjack Table'::text,
  status text not null default 'lobby'::text,
  dealer_id uuid,
  current_round_id uuid,
  remaining_cards text[] not null default '{}'::text[],
  discard_pile text[] not null default '{}'::text[],
  last_reshuffle_at timestamp with time zone,
  dealer_hand text[] not null default '{}'::text[],
  dealer_visible_card text,
  dealer_status text not null default 'waiting'::text,
  turn_order uuid[] not null default '{}'::uuid[],
  current_turn_index integer,
  settings jsonb not null default '{"max_bet": 100, "min_bet": 1, "num_decks": 6, "max_splits": 3, "split_enabled": true, "bet_increments": [1, 2, 5, 10, 25], "hit_on_soft_17": true, "blackjack_payout": 1.5, "insurance_enabled": true, "double_down_enabled": true}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint blackjack_games_code_key UNIQUE (code),
  constraint blackjack_games_pkey PRIMARY KEY (id)
);
alter table public.blackjack_games enable row level security;

create table if not exists public.blackjack_hands (
  id uuid not null default gen_random_uuid(),
  round_id uuid not null,
  player_id uuid not null,
  hand_index integer not null default 0,
  cards text[] not null default '{}'::text[],
  bet_amount integer not null default 0,
  status text not null default 'betting'::text,
  is_active boolean not null default false,
  insurance_bet integer not null default 0,
  result text,
  payout integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint blackjack_hands_pkey PRIMARY KEY (id),
  constraint blackjack_hands_player_id_fkey FOREIGN KEY (player_id) REFERENCES blackjack_players(id) ON DELETE CASCADE,
  constraint blackjack_hands_round_id_fkey FOREIGN KEY (round_id) REFERENCES blackjack_rounds(id) ON DELETE CASCADE
);
alter table public.blackjack_hands enable row level security;

create table if not exists public.blackjack_history (
  id uuid not null default gen_random_uuid(),
  game_id uuid not null,
  round_id uuid,
  player_id uuid not null,
  player_hand text[] not null,
  player_value integer not null,
  dealer_hand text[] not null,
  dealer_value integer not null,
  bet_amount integer not null,
  payout integer not null,
  result text not null,
  summary text,
  created_at timestamp with time zone not null default now(),
  constraint blackjack_history_pkey PRIMARY KEY (id),
  constraint blackjack_history_game_id_fkey FOREIGN KEY (game_id) REFERENCES blackjack_games(id) ON DELETE CASCADE,
  constraint blackjack_history_player_id_fkey FOREIGN KEY (player_id) REFERENCES blackjack_players(id) ON DELETE CASCADE,
  constraint blackjack_history_round_id_fkey FOREIGN KEY (round_id) REFERENCES blackjack_rounds(id) ON DELETE SET NULL
);
alter table public.blackjack_history enable row level security;

create table if not exists public.blackjack_players (
  id uuid not null default gen_random_uuid(),
  game_id uuid not null,
  name text not null,
  is_dealer boolean not null default false,
  is_online boolean not null default true,
  last_seen_at timestamp with time zone not null default now(),
  seat_position integer,
  balance integer not null default 0,
  total_bought_in integer not null default 0,
  current_bet integer not null default 0,
  has_placed_bet boolean not null default false,
  hands_played integer not null default 0,
  hands_won integer not null default 0,
  hands_lost integer not null default 0,
  hands_pushed integer not null default 0,
  blackjacks integer not null default 0,
  busts integer not null default 0,
  times_hit integer not null default 0,
  times_stood integer not null default 0,
  times_doubled integer not null default 0,
  times_split integer not null default 0,
  times_surrendered integer not null default 0,
  times_insurance integer not null default 0,
  total_wagered integer not null default 0,
  total_won integer not null default 0,
  total_lost integer not null default 0,
  biggest_win integer not null default 0,
  biggest_bet integer not null default 0,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  worst_streak integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  player_order integer,
  buy_in_with_sips boolean not null default false,
  sips_owed integer not null default 0,
  constraint blackjack_players_pkey PRIMARY KEY (id),
  constraint blackjack_players_game_id_fkey FOREIGN KEY (game_id) REFERENCES blackjack_games(id) ON DELETE CASCADE
);
alter table public.blackjack_players enable row level security;

create table if not exists public.blackjack_rounds (
  id uuid not null default gen_random_uuid(),
  game_id uuid not null,
  round_number integer not null default 1,
  status text not null default 'betting'::text,
  dealer_final_hand text[] not null default '{}'::text[],
  dealer_final_value integer,
  dealer_busted boolean not null default false,
  dealer_blackjack boolean not null default false,
  betting_started_at timestamp with time zone,
  dealing_started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint blackjack_rounds_pkey PRIMARY KEY (id),
  constraint blackjack_rounds_game_id_fkey FOREIGN KEY (game_id) REFERENCES blackjack_games(id) ON DELETE CASCADE
);
alter table public.blackjack_rounds enable row level security;

create table if not exists public.commands (
  id bigint not null,
  created_at timestamp with time zone default now(),
  cmd text not null,
  payload jsonb,
  status text default 'pending'::text,
  constraint commands_pkey PRIMARY KEY (id)
);

create table if not exists public.device_status (
  device_id text not null,
  last_seen timestamp with time zone default now(),
  info jsonb,
  constraint device_status_pkey PRIMARY KEY (device_id)
);

create table if not exists public.drunk_users (
  id uuid not null default gen_random_uuid(),
  username text not null,
  password text,
  first_name text,
  last_name text,
  avatar_url text,
  bio text,
  wins integer default 0,
  losses integer default 0,
  created_at timestamp with time zone default now(),
  total_sips integer not null default 0,
  auth_user_id uuid,
  phone text,
  constraint drunk_users_auth_user_id_key UNIQUE (auth_user_id),
  constraint drunk_users_phone_key UNIQUE (phone),
  constraint drunk_users_username_key UNIQUE (username),
  constraint drunk_users_pkey PRIMARY KEY (id),
  constraint drunk_users_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint drunk_users_phone_format CHECK (((phone IS NULL) OR (phone ~ '^\+1[2-9][0-9]{9}$'::text)))
);

create table if not exists public.drunkopoly_chat_members (
  chat_id uuid not null,
  player_id uuid not null,
  joined_at timestamp with time zone not null default now(),
  last_read_at timestamp with time zone,
  constraint drunkopoly_chat_members_pkey PRIMARY KEY (chat_id, player_id),
  constraint drunkopoly_chat_members_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES drunkopoly_chats(id) ON DELETE CASCADE,
  constraint drunkopoly_chat_members_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

create table if not exists public.drunkopoly_chat_messages (
  id uuid not null default gen_random_uuid(),
  chat_id uuid not null,
  game_id uuid not null,
  sender_player_id uuid not null,
  body text not null,
  kind text default 'chat'::text,
  meta jsonb,
  created_at timestamp with time zone not null default now(),
  constraint drunkopoly_chat_messages_pkey PRIMARY KEY (id),
  constraint drunkopoly_chat_messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES drunkopoly_chats(id) ON DELETE CASCADE,
  constraint drunkopoly_chat_messages_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  constraint drunkopoly_chat_messages_sender_player_id_fkey FOREIGN KEY (sender_player_id) REFERENCES players(id) ON DELETE CASCADE
);

create table if not exists public.drunkopoly_chats (
  id uuid not null default gen_random_uuid(),
  game_id uuid not null,
  title text,
  created_by_player_id uuid,
  created_at timestamp with time zone not null default now(),
  constraint drunkopoly_chats_pkey PRIMARY KEY (id),
  constraint drunkopoly_chats_created_by_player_id_fkey FOREIGN KEY (created_by_player_id) REFERENCES players(id) ON DELETE SET NULL,
  constraint drunkopoly_chats_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

create table if not exists public.drunkopoly_page_views (
  id uuid not null,
  visitor_id text not null,
  session_id text not null,
  page text not null,
  referrer text,
  device text not null default 'desktop'::text,
  signed_in boolean not null default false,
  seconds integer not null default 0,
  created_at timestamp with time zone not null default now(),
  last_seen timestamp with time zone not null default now(),
  constraint drunkopoly_page_views_pkey PRIMARY KEY (id)
);
alter table public.drunkopoly_page_views enable row level security;

create table if not exists public.fin_account_balances (
  id bigint not null,
  owner uuid not null default auth.uid(),
  account_id bigint not null,
  balance_date date not null,
  balance numeric(14,2) not null,
  source text not null default 'manual'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_account_balances_account_id_balance_date_key UNIQUE (account_id, balance_date),
  constraint fin_account_balances_pkey PRIMARY KEY (id),
  constraint fin_account_balances_account_id_fkey FOREIGN KEY (account_id) REFERENCES fin_accounts(id) ON DELETE CASCADE,
  constraint fin_account_balances_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.fin_account_balances enable row level security;

create table if not exists public.fin_accounts (
  id bigint not null,
  owner uuid not null default auth.uid(),
  name text not null,
  account_type text not null,
  institution text,
  last_four text,
  is_liability boolean not null default false,
  include_in_net_worth boolean not null default true,
  is_active boolean not null default true,
  cashback_rate numeric(8,4) not null default 0,
  statement_balance numeric(14,2) not null default 0,
  statement_closing_day integer,
  payment_due_day integer,
  apy numeric(8,4) not null default 0,
  autopay_enabled boolean not null default false,
  payment_account_id bigint,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_accounts_pkey PRIMARY KEY (id),
  constraint fin_accounts_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint fin_accounts_payment_account_id_fkey FOREIGN KEY (payment_account_id) REFERENCES fin_accounts(id) ON DELETE SET NULL
);
alter table public.fin_accounts enable row level security;

create table if not exists public.fin_ai_imports (
  id bigint not null,
  owner uuid not null default auth.uid(),
  source_name text not null,
  status text not null default 'pending'::text,
  content_hash text not null,
  source_type text not null default 'json'::text,
  document_type text,
  schema_version text,
  account_id bigint,
  raw_payload text,
  error_message text,
  transaction_count integer not null default 0,
  duplicate_count integer not null default 0,
  review_count integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_ai_imports_owner_content_hash_key UNIQUE (owner, content_hash),
  constraint fin_ai_imports_pkey PRIMARY KEY (id),
  constraint fin_ai_imports_account_id_fkey FOREIGN KEY (account_id) REFERENCES fin_accounts(id) ON DELETE SET NULL,
  constraint fin_ai_imports_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.fin_ai_imports enable row level security;

create table if not exists public.fin_ai_reviews (
  id bigint not null,
  owner uuid not null default auth.uid(),
  ai_import_id bigint not null,
  transaction_id bigint,
  status text not null default 'needs_review'::text,
  suggested_payload text,
  confidence numeric(5,4),
  reason text,
  duplicate_transaction_id bigint,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_ai_reviews_pkey PRIMARY KEY (id),
  constraint fin_ai_reviews_ai_import_id_fkey FOREIGN KEY (ai_import_id) REFERENCES fin_ai_imports(id) ON DELETE CASCADE,
  constraint fin_ai_reviews_duplicate_transaction_id_fkey FOREIGN KEY (duplicate_transaction_id) REFERENCES fin_transactions(id) ON DELETE SET NULL,
  constraint fin_ai_reviews_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint fin_ai_reviews_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES fin_transactions(id) ON DELETE SET NULL
);
alter table public.fin_ai_reviews enable row level security;

create table if not exists public.fin_financial_goals (
  id bigint not null,
  owner uuid not null default auth.uid(),
  name text not null,
  goal_type text not null,
  target_amount numeric(14,2) not null,
  current_amount numeric(14,2) not null default 0,
  recommended_monthly numeric(14,2) not null default 0,
  user_monthly_target numeric(14,2) not null default 0,
  target_date date,
  linked_account_id bigint,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_financial_goals_owner_name_key UNIQUE (owner, name),
  constraint fin_financial_goals_pkey PRIMARY KEY (id),
  constraint fin_financial_goals_linked_account_id_fkey FOREIGN KEY (linked_account_id) REFERENCES fin_accounts(id) ON DELETE SET NULL,
  constraint fin_financial_goals_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.fin_financial_goals enable row level security;

create table if not exists public.fin_investment_accounts (
  id bigint not null,
  owner uuid not null default auth.uid(),
  account_id bigint not null,
  tax_treatment text not null,
  constraint fin_investment_accounts_account_id_key UNIQUE (account_id),
  constraint fin_investment_accounts_pkey PRIMARY KEY (id),
  constraint fin_investment_accounts_account_id_fkey FOREIGN KEY (account_id) REFERENCES fin_accounts(id) ON DELETE CASCADE,
  constraint fin_investment_accounts_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.fin_investment_accounts enable row level security;

create table if not exists public.fin_investment_holdings (
  id bigint not null,
  owner uuid not null default auth.uid(),
  investment_account_id bigint not null,
  security_id bigint not null,
  quantity numeric(20,8) not null,
  cost_basis numeric(14,2) not null,
  as_of_date date,
  constraint fin_investment_holdings_investment_account_id_security_id_key UNIQUE (investment_account_id, security_id),
  constraint fin_investment_holdings_pkey PRIMARY KEY (id),
  constraint fin_investment_holdings_investment_account_id_fkey FOREIGN KEY (investment_account_id) REFERENCES fin_investment_accounts(id) ON DELETE CASCADE,
  constraint fin_investment_holdings_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint fin_investment_holdings_security_id_fkey FOREIGN KEY (security_id) REFERENCES fin_securities(id) ON DELETE CASCADE
);
alter table public.fin_investment_holdings enable row level security;

create table if not exists public.fin_investment_snapshots (
  id bigint not null,
  owner uuid not null default auth.uid(),
  investment_account_id bigint not null,
  security_id bigint not null,
  snapshot_date date not null,
  quantity numeric(20,8) not null,
  price numeric(20,8) not null,
  market_value numeric(14,2) not null,
  cost_basis numeric(14,2) not null,
  source text not null default 'manual'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_investment_snapshots_investment_account_id_security_id__key UNIQUE (investment_account_id, security_id, snapshot_date),
  constraint fin_investment_snapshots_pkey PRIMARY KEY (id),
  constraint fin_investment_snapshots_investment_account_id_fkey FOREIGN KEY (investment_account_id) REFERENCES fin_investment_accounts(id) ON DELETE CASCADE,
  constraint fin_investment_snapshots_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint fin_investment_snapshots_security_id_fkey FOREIGN KEY (security_id) REFERENCES fin_securities(id) ON DELETE CASCADE
);
alter table public.fin_investment_snapshots enable row level security;

create table if not exists public.fin_investment_transactions (
  id bigint not null,
  owner uuid not null default auth.uid(),
  investment_account_id bigint not null,
  security_id bigint,
  transaction_date date not null,
  transaction_type text not null,
  amount numeric(14,2) not null,
  quantity numeric(20,8),
  fees numeric(14,2) not null default 0,
  notes text,
  constraint fin_investment_transactions_pkey PRIMARY KEY (id),
  constraint fin_investment_transactions_investment_account_id_fkey FOREIGN KEY (investment_account_id) REFERENCES fin_investment_accounts(id) ON DELETE CASCADE,
  constraint fin_investment_transactions_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint fin_investment_transactions_security_id_fkey FOREIGN KEY (security_id) REFERENCES fin_securities(id) ON DELETE SET NULL
);
alter table public.fin_investment_transactions enable row level security;

create table if not exists public.fin_merchant_rules (
  id bigint not null,
  owner uuid not null default auth.uid(),
  merchant_pattern text not null,
  normalized_merchant text not null,
  category_id bigint,
  subcategory_id bigint,
  is_transfer boolean not null default false,
  times_applied integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_merchant_rules_owner_merchant_pattern_key UNIQUE (owner, merchant_pattern),
  constraint fin_merchant_rules_pkey PRIMARY KEY (id),
  constraint fin_merchant_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES fin_transaction_categories(id) ON DELETE SET NULL,
  constraint fin_merchant_rules_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint fin_merchant_rules_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES fin_transaction_categories(id) ON DELETE SET NULL
);
alter table public.fin_merchant_rules enable row level security;

create table if not exists public.fin_month_plans (
  id bigint not null,
  owner uuid not null default auth.uid(),
  plan_month date not null,
  status text not null default 'open'::text,
  closed_at timestamp with time zone,
  swept_amount numeric(14,2) not null default 0,
  swept_to_account_id bigint,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_month_plans_owner_plan_month_key UNIQUE (owner, plan_month),
  constraint fin_month_plans_pkey PRIMARY KEY (id),
  constraint fin_month_plans_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint fin_month_plans_swept_to_account_id_fkey FOREIGN KEY (swept_to_account_id) REFERENCES fin_accounts(id) ON DELETE SET NULL
);
alter table public.fin_month_plans enable row level security;

create table if not exists public.fin_monthly_ai_insights (
  id bigint not null,
  owner uuid not null default auth.uid(),
  snapshot_month date not null,
  status text not null default 'metrics_ready'::text,
  metrics_json text not null,
  commentary_json text,
  source text not null default 'manual'::text,
  model text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_monthly_ai_insights_owner_snapshot_month_key UNIQUE (owner, snapshot_month),
  constraint fin_monthly_ai_insights_pkey PRIMARY KEY (id),
  constraint fin_monthly_ai_insights_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.fin_monthly_ai_insights enable row level security;

create table if not exists public.fin_monthly_snapshots (
  id bigint not null,
  owner uuid not null default auth.uid(),
  snapshot_month date not null,
  net_worth numeric(14,2) not null,
  liquid_cash numeric(14,2) not null,
  income numeric(14,2) not null,
  spending numeric(14,2) not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_monthly_snapshots_owner_snapshot_month_key UNIQUE (owner, snapshot_month),
  constraint fin_monthly_snapshots_pkey PRIMARY KEY (id),
  constraint fin_monthly_snapshots_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.fin_monthly_snapshots enable row level security;

create table if not exists public.fin_paycheck_allocations (
  id bigint not null,
  owner uuid not null default auth.uid(),
  paycheck_id bigint not null,
  plan_month date not null,
  target_kind text not null,
  target_id bigint,
  label text not null,
  amount numeric(14,2) not null default 0,
  requested_amount numeric(14,2) not null default 0,
  destination_account_id bigint,
  transfer_id bigint,
  note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_paycheck_allocations_paycheck_id_target_kind_target_id__key UNIQUE (paycheck_id, target_kind, target_id, label),
  constraint fin_paycheck_allocations_pkey PRIMARY KEY (id),
  constraint fin_paycheck_allocations_destination_account_id_fkey FOREIGN KEY (destination_account_id) REFERENCES fin_accounts(id) ON DELETE SET NULL,
  constraint fin_paycheck_allocations_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint fin_paycheck_allocations_paycheck_id_fkey FOREIGN KEY (paycheck_id) REFERENCES fin_paychecks(id) ON DELETE CASCADE,
  constraint fin_paycheck_allocations_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES fin_transfers(id) ON DELETE SET NULL
);
alter table public.fin_paycheck_allocations enable row level security;

create table if not exists public.fin_paycheck_deductions (
  id bigint not null,
  owner uuid not null default auth.uid(),
  paycheck_id bigint not null,
  name text not null,
  deduction_type text not null,
  amount numeric(14,2) not null,
  is_pre_tax boolean not null default false,
  constraint fin_paycheck_deductions_pkey PRIMARY KEY (id),
  constraint fin_paycheck_deductions_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint fin_paycheck_deductions_paycheck_id_fkey FOREIGN KEY (paycheck_id) REFERENCES fin_paychecks(id) ON DELETE CASCADE
);
alter table public.fin_paycheck_deductions enable row level security;

create table if not exists public.fin_paychecks (
  id bigint not null,
  owner uuid not null default auth.uid(),
  pay_date date not null,
  pay_period_start date,
  pay_period_end date,
  employer text not null,
  regular_hours numeric(8,2) not null default 80,
  gross_amount numeric(14,2) not null,
  net_amount numeric(14,2) not null,
  federal_withholding numeric(14,2) not null default 0,
  virginia_withholding numeric(14,2) not null default 0,
  social_security numeric(14,2) not null default 0,
  medicare numeric(14,2) not null default 0,
  roth_401k numeric(14,2) not null default 0,
  employer_401k_match numeric(14,2) not null default 0,
  other_deductions numeric(14,2) not null default 0,
  pto_earned numeric(10,4) not null default 0,
  pto_used numeric(10,4) not null default 0,
  destination_account_id bigint,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_paychecks_pkey PRIMARY KEY (id),
  constraint fin_paychecks_destination_account_id_fkey FOREIGN KEY (destination_account_id) REFERENCES fin_accounts(id) ON DELETE SET NULL,
  constraint fin_paychecks_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.fin_paychecks enable row level security;

create table if not exists public.fin_pto_entries (
  id bigint not null,
  owner uuid not null default auth.uid(),
  start_date date not null,
  end_date date not null,
  hours_per_day numeric(6,2) not null default 8,
  leave_type text not null default 'vacation'::text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_pto_entries_pkey PRIMARY KEY (id),
  constraint fin_pto_entries_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint fin_pto_entries_check CHECK ((end_date >= start_date))
);
alter table public.fin_pto_entries enable row level security;

create table if not exists public.fin_recurring_expenses (
  id bigint not null,
  owner uuid not null default auth.uid(),
  name text not null,
  amount numeric(14,2) not null,
  frequency text not null default 'monthly'::text,
  due_day integer,
  is_variable boolean not null default false,
  category_id bigint,
  account_id bigint,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_recurring_expenses_owner_name_key UNIQUE (owner, name),
  constraint fin_recurring_expenses_pkey PRIMARY KEY (id),
  constraint fin_recurring_expenses_account_id_fkey FOREIGN KEY (account_id) REFERENCES fin_accounts(id) ON DELETE SET NULL,
  constraint fin_recurring_expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES fin_transaction_categories(id) ON DELETE SET NULL,
  constraint fin_recurring_expenses_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.fin_recurring_expenses enable row level security;

create table if not exists public.fin_recurring_suggestions (
  id bigint not null,
  owner uuid not null default auth.uid(),
  merchant text not null,
  suggestion_type text not null,
  status text not null default 'needs_review'::text,
  amount numeric(14,2),
  previous_amount numeric(14,2),
  evidence text,
  transaction_id bigint,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_recurring_suggestions_pkey PRIMARY KEY (id),
  constraint fin_recurring_suggestions_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint fin_recurring_suggestions_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES fin_transactions(id) ON DELETE SET NULL
);
alter table public.fin_recurring_suggestions enable row level security;

create table if not exists public.fin_retirement_contributions (
  id bigint not null,
  owner uuid not null default auth.uid(),
  contribution_date date not null,
  account_id bigint not null,
  employee_amount numeric(14,2) not null,
  employer_match numeric(14,2) not null default 0,
  contribution_type text not null default 'roth'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_retirement_contributions_pkey PRIMARY KEY (id),
  constraint fin_retirement_contributions_account_id_fkey FOREIGN KEY (account_id) REFERENCES fin_accounts(id) ON DELETE CASCADE,
  constraint fin_retirement_contributions_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.fin_retirement_contributions enable row level security;

create table if not exists public.fin_securities (
  id bigint not null,
  owner uuid not null default auth.uid(),
  symbol text not null,
  name text not null,
  security_type text not null,
  constraint fin_securities_owner_symbol_key UNIQUE (owner, symbol),
  constraint fin_securities_pkey PRIMARY KEY (id),
  constraint fin_securities_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.fin_securities enable row level security;

create table if not exists public.fin_security_prices (
  id bigint not null,
  owner uuid not null default auth.uid(),
  security_id bigint not null,
  price_date date not null,
  price numeric(20,8) not null,
  source text not null default 'manual'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_security_prices_security_id_price_date_key UNIQUE (security_id, price_date),
  constraint fin_security_prices_pkey PRIMARY KEY (id),
  constraint fin_security_prices_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint fin_security_prices_security_id_fkey FOREIGN KEY (security_id) REFERENCES fin_securities(id) ON DELETE CASCADE
);
alter table public.fin_security_prices enable row level security;

create table if not exists public.fin_settings (
  id bigint not null,
  owner uuid not null default auth.uid(),
  key text not null,
  value text not null,
  value_type text not null default 'string'::text,
  label text not null,
  description text,
  category text not null default 'general'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_settings_owner_key_key UNIQUE (owner, key),
  constraint fin_settings_pkey PRIMARY KEY (id),
  constraint fin_settings_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.fin_settings enable row level security;

create table if not exists public.fin_setup_progress (
  id bigint not null,
  owner uuid not null default auth.uid(),
  current_step integer not null default 1,
  completed boolean not null default false,
  history_option text not null default 'start_today'::text,
  setup_date date,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_setup_progress_owner_key UNIQUE (owner),
  constraint fin_setup_progress_pkey PRIMARY KEY (id),
  constraint fin_setup_progress_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.fin_setup_progress enable row level security;

create table if not exists public.fin_sinking_funds (
  id bigint not null,
  owner uuid not null default auth.uid(),
  name text not null,
  target_amount numeric(14,2) not null,
  current_amount numeric(14,2) not null default 0,
  due_date date,
  linked_account_id bigint,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_sinking_funds_owner_name_key UNIQUE (owner, name),
  constraint fin_sinking_funds_pkey PRIMARY KEY (id),
  constraint fin_sinking_funds_linked_account_id_fkey FOREIGN KEY (linked_account_id) REFERENCES fin_accounts(id) ON DELETE SET NULL,
  constraint fin_sinking_funds_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.fin_sinking_funds enable row level security;

create table if not exists public.fin_subscriptions (
  id bigint not null,
  owner uuid not null default auth.uid(),
  name text not null,
  amount numeric(14,2) not null,
  billing_frequency text not null default 'monthly'::text,
  next_due_date date,
  account_id bigint,
  category_id bigint,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_subscriptions_owner_name_key UNIQUE (owner, name),
  constraint fin_subscriptions_pkey PRIMARY KEY (id),
  constraint fin_subscriptions_account_id_fkey FOREIGN KEY (account_id) REFERENCES fin_accounts(id) ON DELETE SET NULL,
  constraint fin_subscriptions_category_id_fkey FOREIGN KEY (category_id) REFERENCES fin_transaction_categories(id) ON DELETE SET NULL,
  constraint fin_subscriptions_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE
);
alter table public.fin_subscriptions enable row level security;

create table if not exists public.fin_transaction_categories (
  id bigint not null,
  owner uuid not null default auth.uid(),
  name text not null,
  parent_id bigint,
  is_active boolean not null default true,
  constraint fin_transaction_categories_owner_name_parent_id_key UNIQUE (owner, name, parent_id),
  constraint fin_transaction_categories_pkey PRIMARY KEY (id),
  constraint fin_transaction_categories_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint fin_transaction_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES fin_transaction_categories(id) ON DELETE CASCADE
);
alter table public.fin_transaction_categories enable row level security;

create table if not exists public.fin_transactions (
  id bigint not null,
  owner uuid not null default auth.uid(),
  transaction_date date not null,
  posting_date date,
  account_id bigint not null,
  description text not null,
  merchant text,
  raw_description text,
  source_transaction_id text,
  amount numeric(14,2) not null,
  transaction_type text not null,
  category_id bigint,
  subcategory_id bigint,
  notes text,
  is_transfer boolean not null default false,
  is_recurring boolean not null default false,
  source text not null default 'manual'::text,
  confidence numeric(5,4),
  review_required boolean not null default false,
  ai_import_id bigint,
  fingerprint text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_transactions_owner_fingerprint_key UNIQUE (owner, fingerprint),
  constraint fin_transactions_pkey PRIMARY KEY (id),
  constraint fin_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES fin_accounts(id),
  constraint fin_transactions_ai_import_id_fkey FOREIGN KEY (ai_import_id) REFERENCES fin_ai_imports(id) ON DELETE SET NULL,
  constraint fin_transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES fin_transaction_categories(id) ON DELETE SET NULL,
  constraint fin_transactions_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint fin_transactions_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES fin_transaction_categories(id) ON DELETE SET NULL
);
alter table public.fin_transactions enable row level security;

create table if not exists public.fin_transfers (
  id bigint not null,
  owner uuid not null default auth.uid(),
  transfer_date date not null,
  source_account_id bigint not null,
  destination_account_id bigint not null,
  amount numeric(14,2) not null,
  source_transaction_id bigint not null,
  destination_transaction_id bigint not null,
  transfer_kind text not null default 'account_transfer'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fin_transfers_destination_transaction_id_key UNIQUE (destination_transaction_id),
  constraint fin_transfers_source_transaction_id_key UNIQUE (source_transaction_id),
  constraint fin_transfers_pkey PRIMARY KEY (id),
  constraint fin_transfers_destination_account_id_fkey FOREIGN KEY (destination_account_id) REFERENCES fin_accounts(id),
  constraint fin_transfers_destination_transaction_id_fkey FOREIGN KEY (destination_transaction_id) REFERENCES fin_transactions(id) ON DELETE CASCADE,
  constraint fin_transfers_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint fin_transfers_source_account_id_fkey FOREIGN KEY (source_account_id) REFERENCES fin_accounts(id),
  constraint fin_transfers_source_transaction_id_fkey FOREIGN KEY (source_transaction_id) REFERENCES fin_transactions(id) ON DELETE CASCADE
);
alter table public.fin_transfers enable row level security;

create table if not exists public.games (
  id uuid not null default gen_random_uuid(),
  code text not null,
  name text,
  status text not null default 'active'::text,
  host_player_id uuid,
  free_parking_balance integer not null default 0,
  initial_balance integer not null default 1500,
  pass_go_amount integer not null default 200,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  trade_timer_seconds integer not null default 60,
  trade_timer_expires_at timestamp with time zone,
  trade_locked boolean not null default false,
  trade_started_by uuid,
  show_balances boolean not null default true,
  sips_enabled boolean not null default true,
  expansion_enabled boolean not null default false,
  gambling_enabled boolean default false,
  constraint games_code_key UNIQUE (code),
  constraint games_pkey PRIMARY KEY (id)
);

create table if not exists public.money_events (
  id uuid not null default gen_random_uuid(),
  game_id uuid not null,
  actor_player_id uuid,
  from_player_id uuid,
  to_player_id uuid,
  amount integer not null,
  type text not null,
  description text,
  created_at timestamp with time zone not null default now(),
  constraint money_events_pkey PRIMARY KEY (id),
  constraint money_events_actor_player_id_fkey FOREIGN KEY (actor_player_id) REFERENCES players(id),
  constraint money_events_from_player_id_fkey FOREIGN KEY (from_player_id) REFERENCES players(id),
  constraint money_events_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  constraint money_events_to_player_id_fkey FOREIGN KEY (to_player_id) REFERENCES players(id)
);

create table if not exists public.player_statistics (
  id uuid not null default gen_random_uuid(),
  game_id uuid not null,
  player_id uuid not null,
  times_passed_go integer not null default 0,
  times_went_to_jail integer not null default 0,
  times_landed_free_parking integer not null default 0,
  money_received_from_go integer not null default 0,
  money_received_from_free_parking integer not null default 0,
  money_received_from_players integer not null default 0,
  money_received_from_bank integer not null default 0,
  total_money_received integer not null default 0,
  money_paid_to_bank integer not null default 0,
  money_paid_to_players integer not null default 0,
  money_paid_for_jail integer not null default 0,
  total_money_spent integer not null default 0,
  total_tax_paid integer not null default 0,
  total_rent_paid integer not null default 0,
  total_rent_received integer not null default 0,
  times_others_landed_on_properties integer not null default 0,
  current_luck_score numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint player_statistics_pkey PRIMARY KEY (id),
  constraint player_statistics_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  constraint player_statistics_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);
alter table public.player_statistics enable row level security;

create table if not exists public.players (
  id uuid not null default gen_random_uuid(),
  game_id uuid not null,
  name text not null,
  balance integer not null default 0,
  pending_sips integer not null default 0,
  is_commissioner boolean not null default false,
  is_online boolean not null default true,
  last_seen_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  total_sips integer not null default 0,
  in_jail boolean default false,
  jail_started_by uuid,
  jail_started_at timestamp with time zone,
  has_get_out_of_jail_card boolean default false,
  has_new_messenger boolean not null default false,
  messenger_data text,
  is_bankrupt boolean not null default false,
  bankrupt_at timestamp with time zone,
  avatar_url text,
  user_id uuid,
  constraint players_pkey PRIMARY KEY (id),
  constraint players_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  constraint players_user_id_fkey FOREIGN KEY (user_id) REFERENCES drunk_users(id) ON DELETE SET NULL
);

create table if not exists public.property_landing_stats (
  id uuid not null default gen_random_uuid(),
  game_id uuid not null,
  property_id text not null,
  times_landed integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint property_landing_stats_pkey PRIMARY KEY (id),
  constraint property_landing_stats_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
alter table public.property_landing_stats enable row level security;

create table if not exists public.property_ownership (
  id uuid not null default gen_random_uuid(),
  game_id uuid not null,
  player_id uuid,
  property_id text not null,
  houses integer not null default 0,
  is_mortgaged boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint property_ownership_pkey PRIMARY KEY (id),
  constraint property_ownership_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  constraint property_ownership_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);
alter table public.property_ownership enable row level security;

create table if not exists public.sip_events (
  id uuid not null default gen_random_uuid(),
  game_id uuid not null,
  from_player_id uuid,
  to_player_id uuid not null,
  sip_count integer not null,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now(),
  cleared_at timestamp with time zone,
  constraint sip_events_pkey PRIMARY KEY (id),
  constraint sip_events_from_player_id_fkey FOREIGN KEY (from_player_id) REFERENCES players(id),
  constraint sip_events_game_id_fkey FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  constraint sip_events_to_player_id_fkey FOREIGN KEY (to_player_id) REFERENCES players(id)
);

create table if not exists public.telemetry (
  id bigint not null,
  created_at timestamp with time zone default now(),
  type text not null,
  payload jsonb,
  constraint telemetry_pkey PRIMARY KEY (id)
);

create table if not exists public.travel_glasses (
  id uuid not null default gen_random_uuid(),
  trip_id uuid,
  location_name text not null,
  place_detail text,
  latitude double precision,
  longitude double precision,
  collected_at timestamp with time zone,
  story text,
  glass_url text,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  constraint travel_glasses_pkey PRIMARY KEY (id),
  constraint travel_glasses_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES travel_trips(id) ON DELETE SET NULL
);
alter table public.travel_glasses enable row level security;

create table if not exists public.travel_photos (
  id uuid not null default gen_random_uuid(),
  glass_id uuid,
  url text not null,
  caption text,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  constraint travel_photos_pkey PRIMARY KEY (id),
  constraint travel_photos_glass_id_fkey FOREIGN KEY (glass_id) REFERENCES travel_glasses(id) ON DELETE CASCADE
);
alter table public.travel_photos enable row level security;

create table if not exists public.travel_trips (
  id uuid not null default gen_random_uuid(),
  name text not null,
  description text,
  start_date date,
  end_date date,
  cover_url text,
  color text,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  constraint travel_trips_pkey PRIMARY KEY (id)
);
alter table public.travel_trips enable row level security;

create or replace view public.game_events as
 SELECT money_events.id,
    money_events.game_id,
    money_events.created_at,
    'money'::text AS kind,
    money_events.type,
    money_events.actor_player_id,
    money_events.from_player_id,
    money_events.to_player_id,
    money_events.amount,
    NULL::integer AS sip_count,
    money_events.description
   FROM money_events
UNION ALL
 SELECT sip_events.id,
    sip_events.game_id,
    sip_events.created_at,
    'sip'::text AS kind,
    sip_events.status AS type,
    sip_events.from_player_id AS actor_player_id,
    NULL::uuid AS from_player_id,
    sip_events.to_player_id,
    NULL::integer AS amount,
    sip_events.sip_count,
    NULL::text AS description
   FROM sip_events;

CREATE INDEX blackjack_actions_created_idx ON public.blackjack_actions USING btree (game_id, created_at DESC);

CREATE INDEX blackjack_actions_game_id_idx ON public.blackjack_actions USING btree (game_id);

CREATE INDEX blackjack_actions_round_id_idx ON public.blackjack_actions USING btree (round_id);

CREATE INDEX blackjack_actions_sequence_idx ON public.blackjack_actions USING btree (round_id, sequence_number);

CREATE INDEX blackjack_chip_requests_game_idx ON public.blackjack_chip_requests USING btree (game_id);

CREATE INDEX blackjack_chip_requests_pending_idx ON public.blackjack_chip_requests USING btree (game_id, status) WHERE (status = 'pending'::text);

CREATE INDEX blackjack_games_code_idx ON public.blackjack_games USING btree (code);

CREATE INDEX blackjack_games_status_idx ON public.blackjack_games USING btree (status);

CREATE INDEX blackjack_hands_active_idx ON public.blackjack_hands USING btree (round_id, is_active) WHERE (is_active = true);

CREATE INDEX blackjack_hands_player_id_idx ON public.blackjack_hands USING btree (player_id);

CREATE INDEX blackjack_hands_round_id_idx ON public.blackjack_hands USING btree (round_id);

CREATE INDEX blackjack_history_created_idx ON public.blackjack_history USING btree (created_at DESC);

CREATE INDEX blackjack_history_game_idx ON public.blackjack_history USING btree (game_id);

CREATE INDEX blackjack_history_player_idx ON public.blackjack_history USING btree (player_id);

CREATE INDEX blackjack_players_game_id_idx ON public.blackjack_players USING btree (game_id);

CREATE UNIQUE INDEX blackjack_players_game_name_key ON public.blackjack_players USING btree (game_id, name);

CREATE INDEX blackjack_players_player_order_idx ON public.blackjack_players USING btree (game_id, player_order);

CREATE INDEX blackjack_players_seat_idx ON public.blackjack_players USING btree (game_id, seat_position);

CREATE INDEX blackjack_rounds_game_id_idx ON public.blackjack_rounds USING btree (game_id);

CREATE INDEX blackjack_rounds_status_idx ON public.blackjack_rounds USING btree (status);

CREATE UNIQUE INDEX drunk_users_username_lower_key ON public.drunk_users USING btree (lower(username));

CREATE INDEX drunkopoly_chat_members_player_id_idx ON public.drunkopoly_chat_members USING btree (player_id);

CREATE INDEX drunkopoly_chat_messages_chat_id_created_at_idx ON public.drunkopoly_chat_messages USING btree (chat_id, created_at);

CREATE INDEX drunkopoly_chat_messages_game_id_created_at_idx ON public.drunkopoly_chat_messages USING btree (game_id, created_at);

CREATE INDEX drunkopoly_page_views_created_idx ON public.drunkopoly_page_views USING btree (created_at);

CREATE INDEX drunkopoly_page_views_visitor_idx ON public.drunkopoly_page_views USING btree (visitor_id);

CREATE INDEX fin_investment_snapshots_date_idx ON public.fin_investment_snapshots USING btree (owner, snapshot_date);

CREATE INDEX fin_month_plans_month_idx ON public.fin_month_plans USING btree (owner, plan_month);

CREATE INDEX fin_paycheck_allocations_kind_idx ON public.fin_paycheck_allocations USING btree (owner, target_kind);

CREATE INDEX fin_paycheck_allocations_month_idx ON public.fin_paycheck_allocations USING btree (owner, plan_month);

CREATE INDEX fin_pto_entries_dates_idx ON public.fin_pto_entries USING btree (owner, start_date);

CREATE INDEX fin_security_prices_date_idx ON public.fin_security_prices USING btree (owner, price_date);

CREATE INDEX fin_transactions_date_idx ON public.fin_transactions USING btree (owner, transaction_date);

CREATE INDEX fin_transactions_import_idx ON public.fin_transactions USING btree (ai_import_id);

CREATE INDEX fin_transactions_merchant_idx ON public.fin_transactions USING btree (owner, merchant);

CREATE INDEX fin_transactions_posting_idx ON public.fin_transactions USING btree (owner, posting_date);

CREATE INDEX fin_transactions_transfer_idx ON public.fin_transactions USING btree (owner, is_transfer);

CREATE INDEX fin_transactions_type_idx ON public.fin_transactions USING btree (owner, transaction_type);

CREATE INDEX games_code_idx ON public.games USING btree (code);

CREATE INDEX games_trade_expires_idx ON public.games USING btree (trade_timer_expires_at);

CREATE INDEX money_events_game_created_idx ON public.money_events USING btree (game_id, created_at DESC);

CREATE INDEX money_events_game_id_idx ON public.money_events USING btree (game_id);

CREATE INDEX player_statistics_game_id_idx ON public.player_statistics USING btree (game_id);

CREATE UNIQUE INDEX player_statistics_game_player_key ON public.player_statistics USING btree (game_id, player_id);

CREATE INDEX player_statistics_player_id_idx ON public.player_statistics USING btree (player_id);

CREATE INDEX players_game_id_idx ON public.players USING btree (game_id);

CREATE UNIQUE INDEX players_game_name_key ON public.players USING btree (game_id, name);

CREATE INDEX property_landing_stats_game_id_idx ON public.property_landing_stats USING btree (game_id);

CREATE UNIQUE INDEX property_landing_stats_game_property_key ON public.property_landing_stats USING btree (game_id, property_id);

CREATE INDEX property_ownership_game_id_idx ON public.property_ownership USING btree (game_id);

CREATE UNIQUE INDEX property_ownership_game_property_key ON public.property_ownership USING btree (game_id, property_id);

CREATE INDEX property_ownership_player_id_idx ON public.property_ownership USING btree (player_id);

CREATE INDEX sip_events_game_created_idx ON public.sip_events USING btree (game_id, created_at DESC);

CREATE INDEX sip_events_game_id_idx ON public.sip_events USING btree (game_id);

CREATE INDEX travel_glasses_trip_id_idx ON public.travel_glasses USING btree (trip_id);

CREATE INDEX travel_photos_glass_id_idx ON public.travel_photos USING btree (glass_id);

CREATE OR REPLACE FUNCTION public.calculate_hand_value(cards text[])
 RETURNS integer[]
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  total int4 := 0;
  aces int4 := 0;
  card text;
  rank text;
begin
  foreach card in array cards
  loop
    rank := left(card, length(card) - 1);
    case rank
      when 'A' then aces := aces + 1; total := total + 11;
      when 'K', 'Q', 'J' then total := total + 10;
      else total := total + rank::int4;
    end case;
  end loop;
  
  while total > 21 and aces > 0 loop
    total := total - 10;
    aces := aces - 1;
  end loop;
  
  return array[total, case when aces > 0 and total <= 21 then 1 else 0 end];
end;
$function$
;

CREATE OR REPLACE FUNCTION public.can_split(cards text[])
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  rank1 text;
  rank2 text;
begin
  if array_length(cards, 1) != 2 then return false; end if;
  
  rank1 := left(cards[1], length(cards[1]) - 1);
  rank2 := left(cards[2], length(cards[2]) - 1);
  
  if rank1 in ('10', 'J', 'Q', 'K') then rank1 := '10'; end if;
  if rank2 in ('10', 'J', 'Q', 'K') then rank2 := '10'; end if;
  
  return rank1 = rank2;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.device_status_set_last_seen()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.last_seen = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.drunk_my_profile()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (to_jsonb(u) - 'password' - 'auth_user_id')::json
  from public.drunk_users u
  where u.auth_user_id = auth.uid()
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.drunk_sign_in(p_username text, p_password text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare u public.drunk_users;
begin
  select * into u from public.drunk_users where username = p_username;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  if u.password like '$2%' then
    if extensions.crypt(p_password, u.password) <> u.password then
      raise exception 'Incorrect password' using errcode = '28P01';
    end if;
  else
    if coalesce(u.password, '') <> p_password then
      raise exception 'Incorrect password' using errcode = '28P01';
    end if;
    update public.drunk_users set password = extensions.crypt(p_password, extensions.gen_salt('bf')) where id = u.id;
  end if;
  return (to_jsonb(u) - 'password')::json;
end $function$
;

CREATE OR REPLACE FUNCTION public.drunk_sign_up(p_username text, p_password text, p_first_name text, p_last_name text DEFAULT NULL::text, p_avatar_url text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare u public.drunk_users;
begin
  if coalesce(p_username, '') = '' or coalesce(p_password, '') = '' or coalesce(p_first_name, '') = '' then
    raise exception 'Provide username, password and first name';
  end if;
  insert into public.drunk_users (username, password, first_name, last_name, avatar_url, wins, losses)
  values (p_username, extensions.crypt(p_password, extensions.gen_salt('bf')), p_first_name, nullif(p_last_name, ''), p_avatar_url, 0, 0)
  returning * into u;
  return (to_jsonb(u) - 'password')::json;
exception when unique_violation then
  raise exception 'Username already taken' using errcode = '23505';
end $function$
;

CREATE OR REPLACE FUNCTION public.drunk_update_phone(p_phone text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u public.drunk_users;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_phone is null or p_phone !~ '^\+1[2-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit US phone number' using errcode = '22023';
  end if;
  update public.drunk_users set phone = p_phone
  where auth_user_id = auth.uid()
  returning * into u;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  return (to_jsonb(u) - 'password' - 'auth_user_id')::json;
exception when unique_violation then
  raise exception 'That phone number is already linked to another account' using errcode = '23505';
end $function$
;

CREATE OR REPLACE FUNCTION public.drunk_update_username(p_username text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u public.drunk_users;
  v text := btrim(coalesce(p_username, ''));
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if v !~ '^[A-Za-z0-9_.]{3,20}$' then
    raise exception 'Usernames are 3-20 letters, numbers, _ or .' using errcode = '22023';
  end if;
  update public.drunk_users set username = v
  where auth_user_id = auth.uid()
  returning * into u;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  return (to_jsonb(u) - 'password' - 'auth_user_id')::json;
exception when unique_violation then
  raise exception 'That username is taken' using errcode = '23505';
end $function$
;

CREATE OR REPLACE FUNCTION public.drunk_verify_legacy(p_username text, p_password text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  u public.drunk_users;
begin
  select * into u from public.drunk_users
  where lower(username) = lower(btrim(p_username)) and auth_user_id is null;
  if not found or u.password is null then
    return null;
  end if;
  if u.password like '$2%' then
    if extensions.crypt(p_password, u.password) <> u.password then
      return null;
    end if;
  elsif u.password <> p_password then
    return null;
  end if;
  return u.id;
end $function$
;

CREATE OR REPLACE FUNCTION public.drunkopoly_all_time_stats()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with real_games as (
  select g.id, g.code, g.created_at, count(p.id) as np,
         count(p.id) filter (where not coalesce(p.is_bankrupt, false)) as alive
  from games g
  join players p on p.game_id = g.id
  group by g.id
  having count(p.id) >= 2
),
rp as (
  select p.*, lower(trim(p.name)) as who, upper(trim(p.name)) as display
  from players p
  where p.game_id in (select id from real_games)
    and lower(trim(p.name)) not in ('test', '')
),
me as (select m.* from money_events m where m.game_id in (select id from real_games)),
se as (select s.* from sip_events s where s.game_id in (select id from real_games)),
ticks as (
  select game_id, created_at from me
  union all select game_id, created_at from se
  union all select id, created_at from real_games
),
gaps as (
  select game_id,
         extract(epoch from created_at - lag(created_at) over (partition by game_id order by created_at)) as secs
  from ticks
),
game_time as (
  select game_id, sum(secs) filter (where secs <= 1200) as secs from gaps group by game_id
),
game_sips as (
  select game_id, sum(sip_count) as sips from se where status = 'cleared' group by game_id
),
winners as (
  select rp.who from rp
  join real_games g on g.id = rp.game_id
  where g.alive = 1 and not coalesce(rp.is_bankrupt, false)
),
people as (
  select rp.who,
         max(rp.display) as name,
         count(*) as games,
         coalesce(sum(rp.total_sips), 0) as sips_taken,
         count(*) filter (where rp.is_bankrupt) as bankruptcies,
         max(rp.avatar_url) as avatar_url
  from rp group by rp.who
),
given as (
  select rp.who, sum(se.sip_count) as sips_given
  from se join rp on rp.id = se.from_player_id group by rp.who
),
jailed as (
  select rp.who, count(*) as n from me join rp on rp.id = me.to_player_id where me.type = 'jail' group by rp.who
),
passed_go as (
  select rp.who, count(*) as n from me join rp on rp.id = me.to_player_id where me.type = 'go' group by rp.who
),
wins as (select who, count(*) as n from winners group by who),
board as (
  select pe.name, pe.games, pe.sips_taken, pe.bankruptcies, pe.avatar_url,
         coalesce(gv.sips_given, 0) as sips_given,
         coalesce(j.n, 0) as jailed,
         coalesce(pg.n, 0) as passed_go,
         coalesce(w.n, 0) as wins
  from people pe
  left join given gv on gv.who = pe.who
  left join jailed j on j.who = pe.who
  left join passed_go pg on pg.who = pe.who
  left join wins w on w.who = pe.who
)
select json_build_object(
  'first_game', (select min(created_at) from real_games),
  'last_game', (select max(created_at) from real_games),
  'games', (select count(*) from real_games),
  'nights', (select count(distinct (created_at at time zone 'America/New_York')::date) from real_games),
  'players', (select count(*) from people),
  'seats', (select count(*) from rp),
  'hours', (select round(coalesce(sum(secs), 0) / 3600.0, 1) from game_time),
  'sips', (select coalesce(sum(sip_count), 0) from se where status = 'cleared'),
  'pours', (select count(*) from se),
  'biggest_pour', (select coalesce(max(sip_count), 0) from se),
  'passed_go', (select count(*) from me where type = 'go'),
  'go_money', (select coalesce(sum(amount), 0) from me where type = 'go'),
  'jailings', (select count(*) from me where type = 'jail'),
  'jail_fines', (select coalesce(sum(amount), 0) from me where type = 'jail_payment'),
  'jail_cards', (select count(*) from me where type = 'jail_card_used'),
  'tax', (select coalesce(sum(amount), 0) from me where type = 'tax'),
  'free_parking_hits', (select count(*) from me where type = 'free_parking_collect'),
  'free_parking_money', (select coalesce(sum(amount), 0) from me where type = 'free_parking_collect'),
  'free_parking_jackpot', (select coalesce(max(amount), 0) from me where type = 'free_parking_collect'),
  'gambles', (select count(*) from me where type = 'gamble'),
  'gamble_wins', (select count(*) from me where type = 'gamble' and description ilike '%won%'),
  'trade_timers', (select count(*) from me where type = 'trade_timer_start'),
  'bankruptcies', (select count(*) from rp where is_bankrupt),
  'wettest_game', (
    select json_build_object('code', g.code, 'date', g.created_at, 'sips', gs.sips, 'players', g.np)
    from real_games g join game_sips gs on gs.game_id = g.id
    order by gs.sips desc limit 1
  ),
  'longest_game', (
    select json_build_object('code', g.code, 'date', g.created_at, 'hours', round(gt.secs / 3600.0, 1))
    from real_games g join game_time gt on gt.game_id = g.id
    where gt.secs is not null
    order by gt.secs desc limit 1
  ),
  'months', (
    select coalesce(json_agg(json_build_object('month', m.month, 'games', m.games, 'sips', m.sips) order by m.month), '[]'::json)
    from (
      select to_char(g.created_at at time zone 'America/New_York', 'YYYY-MM') as month,
             count(*) as games, coalesce(sum(gs.sips), 0) as sips
      from real_games g left join game_sips gs on gs.game_id = g.id
      group by 1
    ) m
  ),
  'weekdays', (
    select json_agg(coalesce(c.n, 0) order by d.dow)
    from generate_series(0, 6) as d(dow)
    left join (
      select extract(dow from created_at at time zone 'America/New_York')::int as dow, count(*) as n
      from real_games group by 1
    ) c on c.dow = d.dow
  ),
  'leaders', (
    select coalesce(json_agg(row_to_json(b) order by b.games desc, b.sips_taken desc), '[]'::json)
    from (select * from board where games >= 2) b
  )
);
$function$
;

CREATE OR REPLACE FUNCTION public.drunkopoly_player_stats(p_name text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with real_games as (
  select g.id, g.code, g.created_at, count(p.id) as np,
         count(p.id) filter (where not coalesce(p.is_bankrupt, false)) as alive
  from games g
  join players p on p.game_id = g.id
  group by g.id
  having count(p.id) >= 2
),
rp_all as (
  select p.*, lower(trim(p.name)) as who
  from players p
  where p.game_id in (select id from real_games)
    and lower(trim(p.name)) not in ('test', '')
),
acct as (
  select u.id, u.username, u.first_name, u.last_name, u.avatar_url, u.bio, u.created_at
  from drunk_users u
  where u.id = coalesce(
    p_user_id,
    (select r.user_id from rp_all r
      where r.who = lower(trim(p_name)) and r.user_id is not null
      group by r.user_id order by count(*) desc limit 1),
    (select u2.id from drunk_users u2 where lower(u2.username) = lower(trim(p_name)) limit 1)
  )
  limit 1
),
names as (
  select lower(trim(p_name)) as who where p_name is not null and trim(p_name) <> ''
  union
  select r.who from rp_all r where r.user_id = (select id from acct)
),
rp as (
  select r.* from rp_all r
  where r.who in (select who from names) or r.user_id = (select id from acct)
),
others as (select r.* from rp_all r where r.id not in (select id from rp)),
me as (select m.* from money_events m where m.game_id in (select game_id from rp)),
se as (select s.* from sip_events s where s.game_id in (select game_id from rp)),
mine as (
  select rp.id, rp.game_id, rp.total_sips, coalesce(rp.is_bankrupt, false) as bankrupt,
         g.code, g.created_at, g.np,
         (g.alive = 1 and not coalesce(rp.is_bankrupt, false)) as won
  from rp join real_games g on g.id = rp.game_id
),
given as (select s.* from se s where s.from_player_id in (select id from rp)),
taken as (select s.* from se s where s.to_player_id in (select id from rp) and s.status = 'cleared'),
game_given as (select game_id, sum(sip_count) as n from given group by game_id),
ticks as (
  select game_id, created_at from me
  union all select game_id, created_at from se
  union all select game_id, created_at from mine
),
gaps as (
  select game_id, extract(epoch from created_at - lag(created_at) over (partition by game_id order by created_at)) as secs
  from ticks
),
game_time as (select game_id, sum(secs) filter (where secs <= 1200) as secs from gaps group by game_id),
league as (
  select r.who, count(*) as games, coalesce(sum(r.total_sips), 0) as sips,
         count(*) filter (where g.alive = 1 and not coalesce(r.is_bankrupt, false)) as wins
  from rp_all r join real_games g on g.id = r.game_id
  group by r.who having count(*) >= 2
),
my_line as (
  select count(*) as games, coalesce(sum(total_sips), 0) as sips, count(*) filter (where won) as wins from mine
)
select case when not exists (select 1 from mine) and not exists (select 1 from acct) then null else json_build_object(
  'name', coalesce(
    (select upper(trim(r.name)) from rp r group by upper(trim(r.name)) order by count(*) desc limit 1),
    upper(coalesce((select coalesce(first_name, username) from acct), p_name))
  ),
  'aliases', (select coalesce(json_agg(distinct upper(trim(r.name))), '[]'::json) from rp r),
  'account', (select row_to_json(a) from acct a),
  'avatar_url', coalesce(
    (select avatar_url from acct),
    (select r.avatar_url from rp r where r.avatar_url is not null order by r.created_at desc limit 1)
  ),
  'games', (select count(*) from mine),
  'wins', (select count(*) from mine where won),
  'bankruptcies', (select count(*) from mine where bankrupt),
  'nights', (select count(distinct (created_at at time zone 'America/New_York')::date) from mine),
  'hours', (select round(coalesce(sum(secs), 0) / 3600.0, 1) from game_time),
  'first_game', (select min(created_at) from mine),
  'last_game', (select max(created_at) from mine),
  'sips_taken', (select coalesce(sum(total_sips), 0) from mine),
  'sips_given', (select coalesce(sum(sip_count), 0) from given),
  'pours', (select count(*) from given),
  'biggest_pour', (select coalesce(max(sip_count), 0) from given),
  'passed_go', (select count(*) from me where type = 'go' and to_player_id in (select id from rp)),
  'go_money', (select coalesce(sum(amount), 0) from me where type = 'go' and to_player_id in (select id from rp)),
  'jailed', (select count(*) from me where type = 'jail' and to_player_id in (select id from rp)),
  'jail_fines', (select coalesce(sum(amount), 0) from me where type = 'jail_payment' and from_player_id in (select id from rp)),
  'jail_cards', (select count(*) from me where type = 'jail_card_used' and to_player_id in (select id from rp)),
  'tax', (select coalesce(sum(amount), 0) from me where type = 'tax' and from_player_id in (select id from rp)),
  'free_parking_hits', (select count(*) from me where type = 'free_parking_collect' and to_player_id in (select id from rp)),
  'free_parking_money', (select coalesce(sum(amount), 0) from me where type = 'free_parking_collect' and to_player_id in (select id from rp)),
  'free_parking_best', (select coalesce(max(amount), 0) from me where type = 'free_parking_collect' and to_player_id in (select id from rp)),
  'gambles', (select count(*) from me where type = 'gamble' and to_player_id in (select id from rp)),
  'gamble_wins', (select count(*) from me where type = 'gamble' and to_player_id in (select id from rp) and description ilike '%won%'),
  'trade_timers', (select count(*) from me where type = 'trade_timer_start' and actor_player_id in (select id from rp)),
  'wettest_game', (
    select json_build_object('code', code, 'date', created_at, 'sips', total_sips, 'players', np)
    from mine where coalesce(total_sips, 0) > 0 order by total_sips desc limit 1
  ),
  'longest_game', (
    select json_build_object('code', m.code, 'date', m.created_at, 'hours', round(gt.secs / 3600.0, 1))
    from mine m join game_time gt on gt.game_id = m.game_id
    where gt.secs is not null order by gt.secs desc limit 1
  ),
  'nemesis', (
    select json_build_object('name', max(upper(trim(o.name))), 'avatar_url', max(o.avatar_url), 'sips', sum(t.sip_count))
    from taken t join others o on o.id = t.from_player_id
    group by o.who order by sum(t.sip_count) desc limit 1
  ),
  'victim', (
    select json_build_object('name', max(upper(trim(o.name))), 'avatar_url', max(o.avatar_url), 'sips', sum(g.sip_count))
    from given g join others o on o.id = g.to_player_id
    group by o.who order by sum(g.sip_count) desc limit 1
  ),
  'weekdays', (
    select json_agg(coalesce(c.n, 0) order by d.dow)
    from generate_series(0, 6) as d(dow)
    left join (
      select extract(dow from created_at at time zone 'America/New_York')::int as dow, count(*) as n from mine group by 1
    ) c on c.dow = d.dow
  ),
  'recent', (
    select coalesce(json_agg(x order by x.date desc), '[]'::json)
    from (
      select m.code, m.created_at as date, m.np as players, coalesce(m.total_sips, 0) as sips_taken,
             coalesce(gg.n, 0) as sips_given,
             case when m.won then 'won' when m.bankrupt then 'bankrupt' else 'played' end as result
      from mine m left join game_given gg on gg.game_id = m.game_id
      order by m.created_at desc limit 12
    ) x
  ),
  'rank', json_build_object(
    'of', (select count(*) from league),
    'games', (select 1 + count(*) from league l, my_line ml where l.games > ml.games),
    'sips', (select 1 + count(*) from league l, my_line ml where l.sips > ml.sips),
    'wins', (select 1 + count(*) from league l, my_line ml where l.wins > ml.wins)
  )
) end;
$function$
;

CREATE OR REPLACE FUNCTION public.drunkopoly_site_stats()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with v as (
  select *, (created_at at time zone 'America/New_York') as local_at
  from drunkopoly_page_views
),
sessions as (
  select session_id, min(created_at) as started, sum(seconds) as secs, count(*) as views
  from v group by session_id
),
visitor_days as (
  select visitor_id, count(distinct local_at::date) as days from v group by visitor_id
),
today as (select (now() at time zone 'America/New_York')::date as d)
select json_build_object(
  'first_view', (select min(created_at) from v),
  'views', (select count(*) from v),
  'visitors', (select count(distinct visitor_id) from v),
  'sessions', (select count(*) from sessions),
  'returning', (select count(*) from visitor_days where days > 1),
  'live_now', (select count(distinct session_id) from v where last_seen > now() - interval '2 minutes'),
  'views_today', (select count(*) from v, today where local_at::date = today.d),
  'visitors_today', (select count(distinct visitor_id) from v, today where local_at::date = today.d),
  'visitors_7d', (select count(distinct visitor_id) from v where created_at > now() - interval '7 days'),
  'hours', (select round(coalesce(sum(seconds), 0) / 3600.0, 1) from v),
  'game_hours', (select round(coalesce(sum(seconds), 0) / 3600.0, 1) from v where page = 'game'),
  'avg_session_secs', (select coalesce(round(avg(secs)), 0) from sessions where secs > 0),
  'longest_session_secs', (select coalesce(max(secs), 0) from sessions),
  'pages_per_session', (select coalesce(round(avg(views), 1), 0) from sessions),
  'signed_in_share', (select coalesce(round(100.0 * count(*) filter (where signed_in) / nullif(count(*), 0)), 0) from v),
  'days', (
    select json_agg(json_build_object('day', d.day, 'views', coalesce(c.views, 0), 'visitors', coalesce(c.visitors, 0)) order by d.day)
    from (select generate_series(today.d - 29, today.d, interval '1 day')::date as day from today) d
    left join (
      select local_at::date as day, count(*) as views, count(distinct visitor_id) as visitors
      from v group by 1
    ) c on c.day = d.day
  ),
  'hours_of_day', (
    select json_agg(coalesce(c.n, 0) order by h.hr)
    from generate_series(0, 23) as h(hr)
    left join (select extract(hour from local_at)::int as hr, count(*) as n from v group by 1) c on c.hr = h.hr
  ),
  'devices', (
    select coalesce(json_object_agg(device, n), '{}'::json)
    from (select device, count(distinct visitor_id) as n from v group by device) d
  ),
  'pages', (
    select coalesce(json_agg(json_build_object('page', page, 'views', views, 'secs', secs) order by views desc), '[]'::json)
    from (select page, count(*) as views, sum(seconds) as secs from v group by page) p
  ),
  'referrers', (
    select coalesce(json_agg(json_build_object('host', referrer, 'views', n) order by n desc), '[]'::json)
    from (select referrer, count(*) as n from v where referrer is not null group by referrer order by n desc limit 5) r
  )
);
$function$
;

CREATE OR REPLACE FUNCTION public.drunkopoly_track_ping(p_id uuid, p_seconds integer)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update drunkopoly_page_views
     set seconds = greatest(seconds, least(greatest(p_seconds, 0), 8 * 3600)),
         last_seen = now()
   where id = p_id
     and created_at > now() - interval '12 hours';
$function$
;

CREATE OR REPLACE FUNCTION public.drunkopoly_track_view(p_id uuid, p_visitor text, p_session text, p_page text, p_referrer text, p_device text, p_signed_in boolean)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into drunkopoly_page_views (id, visitor_id, session_id, page, referrer, device, signed_in)
  values (
    p_id,
    left(p_visitor, 64),
    left(p_session, 64),
    case when p_page in ('lobby', 'game', 'rules', 'messages', 'player') then p_page else 'other' end,
    nullif(left(p_referrer, 120), ''),
    case when p_device in ('mobile', 'tablet', 'desktop') then p_device else 'desktop' end,
    coalesce(p_signed_in, false)
  )
  on conflict (id) do nothing;
$function$
;

CREATE OR REPLACE FUNCTION public.fin_resync_sequences()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t text;
  seq text;
  max_id bigint;
begin
  if not public.is_site_owner() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for t in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'id'
      and c.table_name like 'fin\_%'
  loop
    seq := pg_get_serial_sequence('public.' || quote_ident(t), 'id');
    if seq is null then
      continue;
    end if;
    execute format('select coalesce(max(id), 0) from public.%I', t) into max_id;
    perform setval(seq, greatest(max_id, 1), max_id > 0);
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fin_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_next_action_sequence(p_round_id uuid)
 RETURNS integer
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(max(sequence_number), 0) + 1
  from public.blackjack_actions
  where round_id = p_round_id;
$function$
;

CREATE OR REPLACE FUNCTION public.is_blackjack(cards text[])
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  hand_value int4[];
begin
  if array_length(cards, 1) != 2 then return false; end if;
  hand_value := calculate_hand_value(cards);
  return hand_value[1] = 21;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_busted(cards text[])
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  hand_value int4[];
begin
  hand_value := calculate_hand_value(cards);
  return hand_value[1] > 21;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_site_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from auth.users
    where id = auth.uid() and email = 'nhambleton03@gmail.com'
  );
$function$
;

CREATE TRIGGER device_status_set_last_seen_trigger BEFORE INSERT OR UPDATE ON public.device_status FOR EACH ROW EXECUTE FUNCTION device_status_set_last_seen();

CREATE TRIGGER fin_account_balances_touch BEFORE UPDATE ON public.fin_account_balances FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_accounts_touch BEFORE UPDATE ON public.fin_accounts FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_ai_imports_touch BEFORE UPDATE ON public.fin_ai_imports FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_ai_reviews_touch BEFORE UPDATE ON public.fin_ai_reviews FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_financial_goals_touch BEFORE UPDATE ON public.fin_financial_goals FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_investment_snapshots_touch BEFORE UPDATE ON public.fin_investment_snapshots FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_merchant_rules_touch BEFORE UPDATE ON public.fin_merchant_rules FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_month_plans_touch BEFORE UPDATE ON public.fin_month_plans FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_monthly_ai_insights_touch BEFORE UPDATE ON public.fin_monthly_ai_insights FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_monthly_snapshots_touch BEFORE UPDATE ON public.fin_monthly_snapshots FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_paycheck_allocations_touch BEFORE UPDATE ON public.fin_paycheck_allocations FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_paychecks_touch BEFORE UPDATE ON public.fin_paychecks FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_pto_entries_touch BEFORE UPDATE ON public.fin_pto_entries FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_recurring_expenses_touch BEFORE UPDATE ON public.fin_recurring_expenses FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_recurring_suggestions_touch BEFORE UPDATE ON public.fin_recurring_suggestions FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_retirement_contributions_touch BEFORE UPDATE ON public.fin_retirement_contributions FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_security_prices_touch BEFORE UPDATE ON public.fin_security_prices FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_settings_touch BEFORE UPDATE ON public.fin_settings FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_setup_progress_touch BEFORE UPDATE ON public.fin_setup_progress FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_sinking_funds_touch BEFORE UPDATE ON public.fin_sinking_funds FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_subscriptions_touch BEFORE UPDATE ON public.fin_subscriptions FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_transactions_touch BEFORE UPDATE ON public.fin_transactions FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

CREATE TRIGGER fin_transfers_touch BEFORE UPDATE ON public.fin_transfers FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();

create policy "Allow all on blackjack_actions" on public.blackjack_actions as PERMISSIVE for ALL to public using (true);

create policy "Allow all on blackjack_chip_requests" on public.blackjack_chip_requests as PERMISSIVE for ALL to public using (true);

create policy "Allow all on blackjack_games" on public.blackjack_games as PERMISSIVE for ALL to public using (true);

create policy "Allow all on blackjack_hands" on public.blackjack_hands as PERMISSIVE for ALL to public using (true);

create policy "Allow all on blackjack_history" on public.blackjack_history as PERMISSIVE for ALL to public using (true);

create policy "Allow all on blackjack_players" on public.blackjack_players as PERMISSIVE for ALL to public using (true);

create policy "Allow all on blackjack_rounds" on public.blackjack_rounds as PERMISSIVE for ALL to public using (true);

create policy fin_account_balances_owner on public.fin_account_balances as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_accounts_owner on public.fin_accounts as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_ai_imports_owner on public.fin_ai_imports as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_ai_reviews_owner on public.fin_ai_reviews as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_financial_goals_owner on public.fin_financial_goals as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_investment_accounts_owner on public.fin_investment_accounts as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_investment_holdings_owner on public.fin_investment_holdings as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_investment_snapshots_owner on public.fin_investment_snapshots as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_investment_transactions_owner on public.fin_investment_transactions as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_merchant_rules_owner on public.fin_merchant_rules as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_month_plans_owner on public.fin_month_plans as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_monthly_ai_insights_owner on public.fin_monthly_ai_insights as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_monthly_snapshots_owner on public.fin_monthly_snapshots as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_paycheck_allocations_owner on public.fin_paycheck_allocations as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_paycheck_deductions_owner on public.fin_paycheck_deductions as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_paychecks_owner on public.fin_paychecks as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_pto_entries_owner on public.fin_pto_entries as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_recurring_expenses_owner on public.fin_recurring_expenses as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_recurring_suggestions_owner on public.fin_recurring_suggestions as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_retirement_contributions_owner on public.fin_retirement_contributions as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_securities_owner on public.fin_securities as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_security_prices_owner on public.fin_security_prices as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_settings_owner on public.fin_settings as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_setup_progress_owner on public.fin_setup_progress as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_sinking_funds_owner on public.fin_sinking_funds as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_subscriptions_owner on public.fin_subscriptions as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_transaction_categories_owner on public.fin_transaction_categories as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_transactions_owner on public.fin_transactions as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy fin_transfers_owner on public.fin_transfers as PERMISSIVE for ALL to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy "Allow all operations on player_statistics" on public.player_statistics as PERMISSIVE for ALL to public using (true);

create policy "Allow all operations on property_landing_stats" on public.property_landing_stats as PERMISSIVE for ALL to public using (true);

create policy "Allow all operations" on public.property_ownership as PERMISSIVE for ALL to public using (true);

create policy "Allow read for game participants" on public.property_ownership as PERMISSIVE for SELECT to public using (true);

create policy travel_glasses_read on public.travel_glasses as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy travel_glasses_write on public.travel_glasses as PERMISSIVE for ALL to authenticated using (( SELECT is_site_owner() AS is_site_owner)) with check (( SELECT is_site_owner() AS is_site_owner));

create policy travel_photos_read on public.travel_photos as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy travel_photos_write on public.travel_photos as PERMISSIVE for ALL to authenticated using (( SELECT is_site_owner() AS is_site_owner)) with check (( SELECT is_site_owner() AS is_site_owner));

create policy travel_trips_read on public.travel_trips as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy travel_trips_write on public.travel_trips as PERMISSIVE for ALL to authenticated using (( SELECT is_site_owner() AS is_site_owner)) with check (( SELECT is_site_owner() AS is_site_owner));
