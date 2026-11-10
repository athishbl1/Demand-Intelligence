with i as (select convert_from(decode($1, 'base64'), 'UTF8')::jsonb as j),
settings as (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) as s from public.team_07_settings),
src as (
  select s.* from public.team_07_strategy_sets s, i
  where i.j->>'action' in ('regenerate', 'custom') and s.id = nullif(i.j->>'set_id', '')::bigint
),
ex as (
  select e.* from public.team_07_explanations e, i
  where e.id = coalesce((select explanation_id from src), nullif(i.j->>'explanation_id', '')::bigint)
),
fb_new as (
  insert into public.team_07_strategy_feedback (set_id, strategy_idx, vote, tags, text, ignore)
  select (select id from src), nullif(x->>'strategy_idx', '')::int, nullif(x->>'vote', '')::smallint,
    coalesce(array(select jsonb_array_elements_text(coalesce(x->'tags', '[]'::jsonb))), '{}'),
    left(nullif(x->>'text', ''), 500), coalesce((x->>'ignore')::boolean, false)
  from i, jsonb_array_elements(coalesce(i.j->'feedback', '[]'::jsonb)) x
  where i.j->>'action' = 'regenerate' and exists (select 1 from src)
  returning strategy_idx, vote, tags, text, ignore
),
cached as (
  select s.id, s.answer, coalesce(s.root_id, s.id) as root_id, s.status, s.accepted_idx
  from public.team_07_strategy_sets s, i
  where i.j->>'action' = 'strategize' and s.explanation_id = (select id from ex) and s.answer is not null
  order by s.created_at desc limit 1
),
root as (select coalesce((select coalesce(root_id, id) from src), (select root_id from cached)) as rid),
versions as (
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'version', s.version, 'change_note', s.change_note,
    'created_at', s.created_at) order by s.version), '[]'::jsonb) as v
  from public.team_07_strategy_sets s, root where coalesce(s.root_id, s.id) = root.rid
),
fb_old as (
  select coalesce(jsonb_agg(jsonb_build_object('set_id', f.set_id, 'strategy_idx', f.strategy_idx, 'vote', f.vote,
    'tags', f.tags, 'text', f.text, 'ignore', f.ignore) order by f.id), '[]'::jsonb) as v
  from public.team_07_strategy_feedback f
  join public.team_07_strategy_sets s on s.id = f.set_id, root
  where coalesce(s.root_id, s.id) = root.rid
)
select jsonb_build_object(
  'settings', (select s from settings),
  'explanation', (select jsonb_build_object('id', id, 'scope', scope, 'change_type', change_type, 'severity', severity,
     'totals', totals, 'facts', facts, 'reasons', reasons, 'headline', headline, 'version', version) from ex),
  'src', (select to_jsonb(src) - 'answer' - 'context' from src),
  'src_context', (select context from src),
  'src_answer', (select answer from src),
  'versions', (select v from versions),
  'feedback', (select v from fb_old),
  'feedback_new', (select coalesce(jsonb_agg(to_jsonb(fb_new)), '[]'::jsonb) from fb_new),
  'cached', (select to_jsonb(cached) from cached)
) as result
