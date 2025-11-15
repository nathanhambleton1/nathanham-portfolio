create view public.game_events as
  select
    id,
    game_id,
    created_at,
    'money'::text as kind,
    type,
    actor_player_id,
    from_player_id,
    to_player_id,
    amount,
    null::int4 as sip_count,
    description
  from public.money_events
union all
  select
    id,
    game_id,
    created_at,
    'sip'::text as kind,
    status as type,
    from_player_id as actor_player_id,
    null::uuid as from_player_id,
    to_player_id,
    null::int4 as amount,
    sip_count,
    null::text as description
  from public.sip_events;
