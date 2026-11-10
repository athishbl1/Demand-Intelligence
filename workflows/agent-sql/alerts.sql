with i as (select convert_from(decode($1, 'base64'), 'UTF8')::jsonb as j),
l as (
  select a.* from public.team_07_alerts a, i
  where case i.j->>'status' when 'open' then a.status <> 'dismissed' else a.status = i.j->>'status' end
  order by a.created_at desc limit 50
)
select jsonb_build_object(
  'alerts', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from l), '[]'::jsonb),
  'unread', (select count(*) from public.team_07_alerts where status = 'unread'),
  'as_of_date', (select value from public.team_07_settings where key = 'as_of_date'),
  'generated_at', now()) as result
