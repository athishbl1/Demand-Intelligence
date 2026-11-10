with i as (select convert_from(decode($1, 'base64'), 'UTF8')::jsonb as j),
e as (
  insert into public.team_07_explanations (scope_key, scope, version, parent_id, root_id, change_type, severity, totals,
    facts, reasons, unexplained_pct, headline, caveat, change_note, model, ai, error, data_updated_at, answer)
  select j->>'scope_key', j->'scope', (j->>'version')::int, nullif(j->>'parent_id', '')::bigint, nullif(j->>'root_id', '')::bigint,
    j->>'change_type', j->>'severity', j->'totals', j->'facts', j->'reasons', nullif(j->>'unexplained_pct', '')::numeric,
    j->>'headline', j->>'caveat', j->>'change_note', j->>'model', coalesce((j->>'ai')::boolean, false), j->>'error',
    nullif(j->>'data_updated_at', '')::timestamptz, j->'answer'
  from i
  returning id, version, change_note, created_at, coalesce(root_id, id) as root
),
a as (
  insert into public.team_07_alerts (explanation_id, date, scope_label, change_type, delta_pct, severity, headline)
  select e.id, (i.j->>'alert_date')::date, i.j->>'alert_label', i.j->>'change_type', nullif(i.j->>'alert_delta', '')::numeric,
    i.j->>'severity', i.j->>'headline'
  from e, i
  where (i.j->>'alert')::boolean
    and not exists (
      select 1 from public.team_07_alerts x
      where x.date = (i.j->>'alert_date')::date and x.change_type = i.j->>'change_type'
        and x.delta_pct is not distinct from nullif(i.j->>'alert_delta', '')::numeric and x.status <> 'dismissed')
  returning id
)
select jsonb_build_object('explanation_id', e.id, 'version', e.version, 'root_id', e.root,
  'change_note', e.change_note, 'created_at', e.created_at, 'alert_id', (select id from a)) as result
from e
