-- One player's all-time Drunkopoly stats, for the player page (opened from a
-- Hall of Fame card) and the signed-in profile.
--
-- Look a player up by table name (p_name, matched case/space-insensitively
-- like the Hall of Fame) or by account (p_user_id = drunk_users.id).
-- Seats are matched both ways: every seat linked to the account, plus every
-- seat played under a name the account has played as. Same "real game" rules
-- as drunkopoly_all_time_stats: at least two players, "test" seats skipped.
-- Only public profile fields come back (never the phone number).

create or replace function public.drunkopoly_player_stats(p_name text default null, p_user_id uuid default null)
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
rp_all as (
  select p.*, lower(trim(p.name)) as who
  from players p
  where p.game_id in (select id from real_games)
    and lower(trim(p.name)) not in ('test', '')
),
-- The account: the one asked for, or the one most often linked to this name.
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
-- Play time, measured the same way as the all-time stats.
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
-- Everyone's totals, for "#n of m" ranks.
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
  -- Who pours on them most, and who they pour on most.
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
$$;

grant execute on function public.drunkopoly_player_stats(text, uuid) to anon, authenticated;
