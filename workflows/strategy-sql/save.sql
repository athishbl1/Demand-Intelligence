with i as (select convert_from(decode($1, 'base64'), 'UTF8')::jsonb as j),
ins as (
  insert into public.team_07_strategy_sets (explanation_id, version, parent_id, root_id, mode, target, context, strategies, custom,
    change_note, model, ai, error, answer)
  select (j->>'explanation_id')::bigint, (j->>'version')::int, nullif(j->>'parent_id', '')::bigint, nullif(j->>'root_id', '')::bigint,
    j->>'mode', j->'target', j->'context', coalesce(j->'strategies', '[]'::jsonb), case when jsonb_typeof(j->'custom') = 'object' then j->'custom' end,
    j->>'change_note', j->>'model', coalesce((j->>'ai')::boolean, false), j->>'error', j->'answer'
  from i where j->>'action' in ('strategize', 'regenerate')
  returning id, version, change_note, created_at, coalesce(root_id, id) as root, status, accepted_idx
),
upd as (
  update public.team_07_strategy_sets s
  set custom = i.j->'custom', answer = coalesce(s.answer, '{}'::jsonb) || jsonb_build_object('custom', i.j->'custom')
  from i where i.j->>'action' = 'custom' and s.id = (i.j->>'set_id')::bigint
  returning s.id, s.version, s.change_note, s.created_at, coalesce(s.root_id, s.id) as root, s.status, s.accepted_idx
),
r as (select * from ins union all select * from upd)
select jsonb_build_object('set_id', r.id, 'version', r.version, 'root_id', r.root, 'change_note', r.change_note,
  'created_at', r.created_at, 'status', r.status, 'accepted_idx', r.accepted_idx) as result
from r
