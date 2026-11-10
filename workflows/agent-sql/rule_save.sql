-- n8n Postgres node "Save rule" (actions rules / rule_save / rule_delete). $1 = base64 JSON from "Validate".
-- "rules" only lists (falls through to "Check rules"); max 20 rules.
with i as (select convert_from(decode($1, 'base64'), 'UTF8')::jsonb as j),
ins as (
  insert into public.team_07_alert_rules (type, threshold, label, enabled)
  select j->>'type', (j->>'threshold')::numeric, nullif(j->>'label', ''), coalesce((j->>'enabled')::boolean, true)
  from i
  where j->>'action' = 'rule_save' and nullif(j->>'rule_id', '') is null
    and (select count(*) from public.team_07_alert_rules) < 20
  returning id
),
upd as (
  update public.team_07_alert_rules r
  set type = coalesce(i.j->>'type', r.type), threshold = coalesce((i.j->>'threshold')::numeric, r.threshold),
      label = case when i.j ? 'label' then nullif(i.j->>'label', '') else r.label end,
      enabled = coalesce((i.j->>'enabled')::boolean, r.enabled), updated_at = now()
  from i
  where i.j->>'action' = 'rule_save' and r.id = nullif(i.j->>'rule_id', '')::bigint
  returning r.id
),
del as (
  delete from public.team_07_alert_rules r using i
  where i.j->>'action' = 'rule_delete' and r.id = (i.j->>'rule_id')::bigint
  returning r.id
)
select jsonb_build_object('saved_id', coalesce((select id from ins), (select id from upd)), 'deleted_id', (select id from del)) as result
