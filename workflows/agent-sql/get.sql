with i as (select convert_from(decode($1, 'base64'), 'UTF8')::jsonb as j),
e as (select * from public.team_07_explanations, i where id = (i.j->>'explanation_id')::bigint),
v as (
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'version', x.version, 'change_note', x.change_note,
    'created_at', x.created_at) order by x.version), '[]'::jsonb) as v
  from public.team_07_explanations x, e where coalesce(x.root_id, x.id) = coalesce(e.root_id, e.id)
),
fb as (
  select jsonb_build_object('up', count(*) filter (where f.vote = 1), 'down', count(*) filter (where f.vote = -1),
    'notes', count(*) filter (where f.text is not null), 'items', coalesce(jsonb_agg(jsonb_build_object('reason_idx', f.reason_idx,
    'vote', f.vote, 'tags', f.tags, 'text', f.text, 'ignore', f.ignore, 'created_at', f.created_at) order by f.id), '[]'::jsonb)) as f
  from public.team_07_feedback f, e where f.explanation_id = e.id
)
select coalesce((select e.answer || jsonb_build_object('explanation_id', e.id, 'root_id', coalesce(e.root_id, e.id),
  'versions', (select v from v), 'feedback_summary', (select f from fb)) from e),
  jsonb_build_object('error', 'explanation_not_found', 'message', 'Explanation not found.')) as result
