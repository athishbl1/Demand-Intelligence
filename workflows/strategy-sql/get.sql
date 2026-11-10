with i as (select convert_from(decode($1, 'base64'), 'UTF8')::jsonb as j),
s as (
  select x.* from public.team_07_strategy_sets x, i
  where (i.j ? 'set_id' and x.id = (i.j->>'set_id')::bigint)
     or (not i.j ? 'set_id' and x.explanation_id = (i.j->>'explanation_id')::bigint)
  order by x.created_at desc limit 1
),
v as (
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'version', x.version, 'change_note', x.change_note,
    'created_at', x.created_at) order by x.version), '[]'::jsonb) as v
  from public.team_07_strategy_sets x, s where coalesce(x.root_id, x.id) = coalesce(s.root_id, s.id)
),
fb as (
  select jsonb_build_object('up', count(*) filter (where f.vote = 1), 'down', count(*) filter (where f.vote = -1),
    'votes', coalesce(jsonb_object_agg(f.strategy_idx::text, f.vote) filter (where f.vote is not null and f.strategy_idx is not null), '{}'::jsonb)) as f
  from public.team_07_strategy_feedback f, s where f.set_id = s.id
)
select coalesce((select s.answer || jsonb_build_object('set_id', s.id, 'root_id', coalesce(s.root_id, s.id), 'status', s.status,
  'accepted_idx', s.accepted_idx, 'decided_at', s.decided_at, 'versions', (select v from v), 'feedback_summary', (select f from fb)) from s),
  jsonb_build_object('error', 'set_not_found', 'message', 'Strategy set not found.')) as result
