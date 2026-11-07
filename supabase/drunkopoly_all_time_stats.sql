-- All-time Drunkopoly stats for the lobby "Hall of Fame".
-- Returns one JSON document so the landing screen needs a single round trip.
-- A "real" game has at least two players; solo games are tests and skipped.
-- Players are matched across games by name (case/space-insensitive).

create or replace function public.drunkopoly_all_time_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
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
-- Every timestamped thing that happened in a game; gaps over 20 minutes are
-- treated as the table walking away, so they don't count as play time.
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
$$;

grant execute on function public.drunkopoly_all_time_stats() to anon, authenticated;
