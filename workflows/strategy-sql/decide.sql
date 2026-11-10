with i as (select convert_from(decode($1, 'base64'), 'UTF8')::jsonb as j),
u as (
  update public.team_07_strategy_sets s set
    status = case i.j->>'choice' when 'dismiss' then 'dismissed' when 'reopen' then 'open' else 'accepted' end,
    accepted_idx = case when i.j->>'choice' in ('dismiss', 'reopen') then null else (i.j->>'choice')::int end,
    decided_at = case when i.j->>'choice' = 'reopen' then null else now() end
  from i
  where s.id = (i.j->>'set_id')::bigint
    and (i.j->>'choice' in ('dismiss', 'reopen')
      or ((i.j->>'choice')::int = 3 and s.custom is not null)
      or ((i.j->>'choice')::int < 3 and (i.j->>'choice')::int < jsonb_array_length(s.strategies)))
  returning s.id, s.status, s.accepted_idx, s.decided_at
)
select coalesce((select jsonb_build_object('ok', true, 'set_id', id, 'status', status, 'accepted_idx', accepted_idx, 'decided_at', decided_at) from u),
  jsonb_build_object('error', 'cannot_decide', 'message', 'This choice does not exist for this strategy set.')) as result
