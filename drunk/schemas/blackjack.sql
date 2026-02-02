-- Blackjack game schemas for session management, hand tracking, and player statistics

-- Main table for a blackjack session/game state
create table public.blackjack_games (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  
  -- Deck management
  -- Format: 'AS', '10H', 'KD', etc. (Rank + Suit)
  remaining_cards text[] not null, 
  discard_pile text[] not null default '{}',
  last_reshuffle_at timestamptz,
  
  -- Dealer state
  dealer_hand text[] not null default '{}',
  dealer_status text not null default 'active', -- 'active', 'stood', 'busted', 'blackjack'
  
  -- Global game settings
  settings jsonb not null default '{
    "num_decks": 6,
    "hit_on_soft_17": true,
    "reshuffle_threshold_percent": 25,
    "blackjack_payout": 1.5,
    "min_bet": 10,
    "max_bet": 1000,
    "allow_split": true,
    "allow_double": true,
    "allow_surrender": false
  }'::jsonb,
  
  -- Current state
  status text not null default 'betting', -- 'betting', 'dealing', 'player_turn', 'dealer_turn', 'finished'
  current_turn_player_id uuid references public.players (id),
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Active hands for players in a round
-- A player can have multiple hands per round (due to splits)
create table public.blackjack_hands (
  id uuid primary key default gen_random_uuid(),
  bj_game_id uuid not null references public.blackjack_games (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  
  hand_index int4 not null default 0, -- 0 for main hand, 1+ for split hands
  cards text[] not null default '{}',
  bet_amount int4 not null default 0,
  
  status text not null default 'active', -- 'active', 'stood', 'busted', 'blackjack', 'surrendered'
  result text, -- 'win', 'loss', 'push', 'blackjack_payout'
  payout_amount int4 not null default 0,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Persistent statistics for players across multiple rounds/games
create table public.blackjack_player_stats (
  player_id uuid primary key references public.players (id) on delete cascade,
  
  -- Aggregate counts
  hands_played int4 not null default 0,
  hands_won int4 not null default 0,
  hands_lost int4 not null default 0,
  hands_pushed int4 not null default 0,
  total_blackjacks int4 not null default 0,
  
  -- Action counts (for "percentage of hitting versus splitting/standing")
  times_hit int4 not null default 0,
  times_stood int4 not null default 0,
  times_doubled int4 not null default 0,
  times_split int4 not null default 0,
  times_surrendered int4 not null default 0,
  
  -- Opportunities (to calculate percentages accurately)
  split_opportunities int4 not null default 0, -- How many times they were dealt a pair
  double_opportunities int4 not null default 0,
  
  -- Financials
  total_wagered int4 not null default 0,
  total_won_amount int4 not null default 0, -- sum of payouts
  total_lost_amount int4 not null default 0, -- sum of lost bets
  max_win_streak int4 not null default 0,
  current_win_streak int4 not null default 0,
  max_payout int4 not null default 0,
  max_bet int4 not null default 0,
  
  -- Derived context
  busts int4 not null default 0,
  dealer_busts_seen int4 not null default 0,
  
  updated_at timestamptz not null default now()
);

-- Historical record of finished hands for auditing and history UI
create table public.blackjack_history (
  id uuid primary key default gen_random_uuid(),
  bj_game_id uuid references public.blackjack_games (id) on delete set null,
  player_id uuid not null references public.players (id) on delete cascade,
  
  player_hand text[] not null,
  dealer_hand text[] not null,
  bet_amount int4 not null,
  payout_amount int4 not null,
  result text not null, -- 'win', 'loss', 'push', etc.
  
  hand_summary text, -- e.g. "Player 21 vs Dealer 18"
  
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index blackjack_games_game_id_idx on public.blackjack_games (game_id);
create index blackjack_hands_bj_game_id_idx on public.blackjack_hands (bj_game_id);
create index blackjack_hands_player_id_idx on public.blackjack_hands (player_id);
create index blackjack_history_player_id_idx on public.blackjack_history (player_id);
create index blackjack_history_created_at_idx on public.blackjack_history (created_at desc);

-- Enable Row Level Security
alter table public.blackjack_games enable row level security;
alter table public.blackjack_hands enable row level security;
alter table public.blackjack_player_stats enable row level security;
alter table public.blackjack_history enable row level security;

-- Policies (Allow all for simplicity, matching other tables in this app)
create policy "Allow all operations on blackjack_games" on public.blackjack_games for all using (true);
create policy "Allow all operations on blackjack_hands" on public.blackjack_hands for all using (true);
create policy "Allow all operations on blackjack_player_stats" on public.blackjack_player_stats for all using (true);
create policy "Allow all operations on blackjack_history" on public.blackjack_history for all using (true);
