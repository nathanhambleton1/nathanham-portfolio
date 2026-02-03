-- Blackjack Game Schema
-- Supports dealer-hosted games with multiple players, real-time sync, and chip management
-- 
-- Architecture:
-- - blackjack_games: Main game/table (dealer creates, players join via code)
-- - blackjack_players: All players at a table (includes dealer + stats)
-- - blackjack_rounds: Individual rounds of play
-- - blackjack_hands: Player hands within a round (supports splits)
-- - blackjack_actions: Event log for real-time sync and animations
-- - blackjack_chip_requests: Players request chips, dealer approves
-- - blackjack_history: Completed hands for historical viewing

--------------------------------------------------------------------------------
-- BLACKJACK GAMES TABLE
-- Main table for a blackjack game/session. The dealer creates this and players join.
--------------------------------------------------------------------------------
create table public.blackjack_games (
  id uuid primary key default gen_random_uuid(),
  
  -- Join code (6 chars like Drunkopoly)
  code text not null unique,
  name text default 'Blackjack Table',
  
  -- Game lifecycle: 'lobby', 'betting', 'dealing', 'playing', 'dealer_turn', 'resolving', 'finished'
  status text not null default 'lobby',
  
  -- Dealer is the host/admin of this table (set after first player insert)
  dealer_id uuid,
  
  -- Current round reference
  current_round_id uuid,
  
  -- Deck management (card format: 'AS', '10H', 'KD', etc.)
  remaining_cards text[] not null default '{}',
  discard_pile text[] not null default '{}',
  last_reshuffle_at timestamptz,
  
  -- Dealer's current hand (during active round)
  dealer_hand text[] not null default '{}',
  dealer_visible_card text, -- The face-up card everyone can see
  dealer_status text not null default 'waiting', -- 'waiting', 'playing', 'stood', 'busted', 'blackjack'
  
  -- Player turn order (array of player IDs in clockwise order set by dealer)
  turn_order uuid[] not null default '{}',
  current_turn_index int4, -- Index into turn_order for whose turn it is
  
  -- Settings
  settings jsonb not null default '{
    "num_decks": 6,
    "hit_on_soft_17": true,
    "blackjack_payout": 1.5,
    "insurance_enabled": true,
    "double_down_enabled": true,
    "split_enabled": true,
    "max_splits": 3,
    "min_bet": 1,
    "max_bet": 100,
    "bet_increments": [1, 2, 5, 10, 25]
  }'::jsonb,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blackjack_games_code_idx on public.blackjack_games (code);
create index blackjack_games_status_idx on public.blackjack_games (status);

--------------------------------------------------------------------------------
-- BLACKJACK PLAYERS TABLE
-- Unified table for all players at a blackjack table (dealer + players with stats)
--------------------------------------------------------------------------------
create table public.blackjack_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.blackjack_games (id) on delete cascade,
  
  -- Player identity
  name text not null,
  is_dealer boolean not null default false,
  is_online boolean not null default true,
  last_seen_at timestamptz not null default now(),
  
  -- Seat position (set by dealer, 1-7 typically, null if not seated yet)
  seat_position int4,
  
  -- Chip balance
  balance int4 not null default 0,
  total_bought_in int4 not null default 0,
  
  -- Current round state (reset each round)
  current_bet int4 not null default 0,
  has_placed_bet boolean not null default false,
  
  -- Lifetime statistics
  hands_played int4 not null default 0,
  hands_won int4 not null default 0,
  hands_lost int4 not null default 0,
  hands_pushed int4 not null default 0,
  blackjacks int4 not null default 0,
  busts int4 not null default 0,
  
  -- Action counts
  times_hit int4 not null default 0,
  times_stood int4 not null default 0,
  times_doubled int4 not null default 0,
  times_split int4 not null default 0,
  times_surrendered int4 not null default 0,
  times_insurance int4 not null default 0,
  
  -- Financial stats
  total_wagered int4 not null default 0,
  total_won int4 not null default 0,
  total_lost int4 not null default 0,
  biggest_win int4 not null default 0,
  biggest_bet int4 not null default 0,
  
  -- Streak tracking
  current_streak int4 not null default 0, -- positive = wins, negative = losses
  best_streak int4 not null default 0,
  worst_streak int4 not null default 0,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index blackjack_players_game_name_key on public.blackjack_players (game_id, name);
create index blackjack_players_game_id_idx on public.blackjack_players (game_id);
create index blackjack_players_seat_idx on public.blackjack_players (game_id, seat_position);

--------------------------------------------------------------------------------
-- BLACKJACK ROUNDS TABLE
-- Tracks individual rounds of play
--------------------------------------------------------------------------------
create table public.blackjack_rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.blackjack_games (id) on delete cascade,
  round_number int4 not null default 1,
  
  -- Round lifecycle: 'betting', 'dealing', 'playing', 'dealer_turn', 'resolving', 'completed'
  status text not null default 'betting',
  
  -- Dealer hand snapshot at end of round
  dealer_final_hand text[] not null default '{}',
  dealer_final_value int4,
  dealer_busted boolean not null default false,
  dealer_blackjack boolean not null default false,
  
  -- Timing
  betting_started_at timestamptz,
  dealing_started_at timestamptz,
  completed_at timestamptz,
  
  created_at timestamptz not null default now()
);

create index blackjack_rounds_game_id_idx on public.blackjack_rounds (game_id);
create index blackjack_rounds_status_idx on public.blackjack_rounds (status);

--------------------------------------------------------------------------------
-- BLACKJACK HANDS TABLE
-- Active hands for players in a round (supports splits)
--------------------------------------------------------------------------------
create table public.blackjack_hands (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.blackjack_rounds (id) on delete cascade,
  player_id uuid not null references public.blackjack_players (id) on delete cascade,
  
  -- Hand index (0 = main hand, 1+ = split hands)
  hand_index int4 not null default 0,
  cards text[] not null default '{}',
  bet_amount int4 not null default 0,
  
  -- Hand state: 'betting', 'active', 'stood', 'busted', 'blackjack', 'surrendered', 'doubled'
  status text not null default 'betting',
  is_active boolean not null default false, -- Currently being played (for splits)
  
  -- Insurance bet (if taken)
  insurance_bet int4 not null default 0,
  
  -- Result after round resolves
  result text, -- 'win', 'loss', 'push', 'blackjack', 'surrender'
  payout int4 not null default 0,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blackjack_hands_round_id_idx on public.blackjack_hands (round_id);
create index blackjack_hands_player_id_idx on public.blackjack_hands (player_id);
create index blackjack_hands_active_idx on public.blackjack_hands (round_id, is_active) where is_active = true;

--------------------------------------------------------------------------------
-- BLACKJACK ACTIONS TABLE
-- Log of all game actions for replay, animation sync, and auditing
--------------------------------------------------------------------------------
create table public.blackjack_actions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.blackjack_games (id) on delete cascade,
  round_id uuid references public.blackjack_rounds (id) on delete cascade,
  player_id uuid references public.blackjack_players (id) on delete cascade,
  hand_id uuid references public.blackjack_hands (id) on delete cascade,
  
  -- Action type (see comments for possible values)
  action_type text not null,
  -- Game flow: 'game_created', 'player_joined', 'player_left', 'round_started', 'round_ended'
  -- Betting: 'bet_placed', 'bet_changed'
  -- Dealing: 'card_dealt_player', 'card_dealt_dealer', 'card_dealt_dealer_hidden'
  -- Player actions: 'hit', 'stand', 'double_down', 'split', 'surrender', 'insurance_taken', 'insurance_declined'
  -- Dealer actions: 'dealer_reveal', 'dealer_hit', 'dealer_stand', 'dealer_bust', 'dealer_blackjack'
  -- Resolution: 'hand_won', 'hand_lost', 'hand_push', 'hand_blackjack', 'insurance_paid', 'payout'
  -- Chips: 'chip_request', 'chip_approved', 'chip_denied', 'buy_in'
  
  -- Action details
  card text, -- Card involved (if applicable)
  amount int4, -- Amount involved (bet, payout, etc.)
  details jsonb, -- Additional structured data
  
  -- Sequence number within round for ordering animations
  sequence_number int4,
  
  created_at timestamptz not null default now()
);

create index blackjack_actions_game_id_idx on public.blackjack_actions (game_id);
create index blackjack_actions_round_id_idx on public.blackjack_actions (round_id);
create index blackjack_actions_created_idx on public.blackjack_actions (game_id, created_at desc);
create index blackjack_actions_sequence_idx on public.blackjack_actions (round_id, sequence_number);

--------------------------------------------------------------------------------
-- BLACKJACK CHIP REQUESTS TABLE
-- Players request more chips, dealer approves/denies
--------------------------------------------------------------------------------
create table public.blackjack_chip_requests (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.blackjack_games (id) on delete cascade,
  player_id uuid not null references public.blackjack_players (id) on delete cascade,
  
  amount int4 not null,
  status text not null default 'pending', -- 'pending', 'approved', 'denied'
  
  handled_by uuid references public.blackjack_players (id),
  handled_at timestamptz,
  
  created_at timestamptz not null default now()
);

create index blackjack_chip_requests_game_idx on public.blackjack_chip_requests (game_id);
create index blackjack_chip_requests_pending_idx on public.blackjack_chip_requests (game_id, status) where status = 'pending';

--------------------------------------------------------------------------------
-- BLACKJACK HISTORY TABLE
-- Completed hands for historical viewing
--------------------------------------------------------------------------------
create table public.blackjack_history (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.blackjack_games (id) on delete cascade,
  round_id uuid references public.blackjack_rounds (id) on delete set null,
  player_id uuid not null references public.blackjack_players (id) on delete cascade,
  
  player_hand text[] not null,
  player_value int4 not null,
  dealer_hand text[] not null,
  dealer_value int4 not null,
  
  bet_amount int4 not null,
  payout int4 not null,
  result text not null,
  
  summary text, -- e.g., "Player 21 vs Dealer 18 - Win!"
  
  created_at timestamptz not null default now()
);

create index blackjack_history_game_idx on public.blackjack_history (game_id);
create index blackjack_history_player_idx on public.blackjack_history (player_id);
create index blackjack_history_created_idx on public.blackjack_history (created_at desc);

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY
--------------------------------------------------------------------------------
alter table public.blackjack_games enable row level security;
alter table public.blackjack_players enable row level security;
alter table public.blackjack_rounds enable row level security;
alter table public.blackjack_hands enable row level security;
alter table public.blackjack_actions enable row level security;
alter table public.blackjack_chip_requests enable row level security;
alter table public.blackjack_history enable row level security;

-- Policies (Allow all for simplicity, matching Drunkopoly pattern)
create policy "Allow all on blackjack_games" on public.blackjack_games for all using (true);
create policy "Allow all on blackjack_players" on public.blackjack_players for all using (true);
create policy "Allow all on blackjack_rounds" on public.blackjack_rounds for all using (true);
create policy "Allow all on blackjack_hands" on public.blackjack_hands for all using (true);
create policy "Allow all on blackjack_actions" on public.blackjack_actions for all using (true);
create policy "Allow all on blackjack_chip_requests" on public.blackjack_chip_requests for all using (true);
create policy "Allow all on blackjack_history" on public.blackjack_history for all using (true);

--------------------------------------------------------------------------------
-- HELPER FUNCTIONS
--------------------------------------------------------------------------------

-- Get next sequence number for actions in a round
create or replace function get_next_action_sequence(p_round_id uuid)
returns int4 as $$
  select coalesce(max(sequence_number), 0) + 1
  from public.blackjack_actions
  where round_id = p_round_id;
$$ language sql;

-- Calculate hand value (handles soft/hard aces)
-- Returns array: [value, is_soft] where is_soft = 1 if contains usable ace
create or replace function calculate_hand_value(cards text[])
returns int4[] as $$
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
$$ language plpgsql immutable;

-- Check if hand is blackjack (21 with exactly 2 cards)
create or replace function is_blackjack(cards text[])
returns boolean as $$
declare
  hand_value int4[];
begin
  if array_length(cards, 1) != 2 then return false; end if;
  hand_value := calculate_hand_value(cards);
  return hand_value[1] = 21;
end;
$$ language plpgsql immutable;

-- Check if hand is busted
create or replace function is_busted(cards text[])
returns boolean as $$
declare
  hand_value int4[];
begin
  hand_value := calculate_hand_value(cards);
  return hand_value[1] > 21;
end;
$$ language plpgsql immutable;

-- Check if hand can split (two cards of same rank)
create or replace function can_split(cards text[])
returns boolean as $$
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
$$ language plpgsql immutable;

--------------------------------------------------------------------------------
-- REALTIME PUBLICATION (run in Supabase dashboard if needed)
--------------------------------------------------------------------------------
-- alter publication supabase_realtime add table public.blackjack_games;
-- alter publication supabase_realtime add table public.blackjack_players;
-- alter publication supabase_realtime add table public.blackjack_rounds;
-- alter publication supabase_realtime add table public.blackjack_hands;
-- alter publication supabase_realtime add table public.blackjack_actions;
-- alter publication supabase_realtime add table public.blackjack_chip_requests;
