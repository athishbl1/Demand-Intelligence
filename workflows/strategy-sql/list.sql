-- Latest version of every strategy set, newest first
with latest as (
  select distinct on (coalesce(s.root_id, s.id)) s.*
  from public.team_07_strategy_sets s
  order by coalesce(s.root_id, s.id), s.version desc
)
select jsonb_build_object('sets', coalesce(jsonb_agg(jsonb_build_object(
  'set_id', l.id, 'version', l.version, 'mode', l.mode, 'status', l.status, 'accepted_idx', l.accepted_idx,
  'target', l.target, 'explanation_id', l.explanation_id, 'scope', e.scope, 'change_type', e.change_type,
  'headline', l.answer->>'headline', 'count', jsonb_array_length(l.strategies),
  'titles', (select coalesce(jsonb_agg(x->>'title'), '[]'::jsonb) from jsonb_array_elements(l.strategies) x),
  'custom_title', l.custom->>'title', 'created_at', l.created_at, 'decided_at', l.decided_at
) order by l.created_at desc), '[]'::jsonb), 'generated_at', now()) as result
from latest l join public.team_07_explanations e on e.id = l.explanation_id
where $1 is not null
