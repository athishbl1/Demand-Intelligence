with i as (select convert_from(decode($1, 'base64'), 'UTF8')::jsonb as j),
old as (select a.id, a.status from public.team_07_alerts a, i where a.id = (i.j->>'id')::bigint),
u as (
  update public.team_07_alerts a set status = i.j->>'status' from i
  where a.id = (i.j->>'id')::bigint returning a.id, a.status
)
select jsonb_build_object('ok', exists (select 1 from u), 'id', (select id from u), 'status', (select status from u),
  'unread', (select count(*) from public.team_07_alerts where status = 'unread')
    - coalesce((select case when old.status = 'unread' and u.status <> 'unread' then 1
                            when old.status <> 'unread' and u.status = 'unread' then -1 else 0 end from old, u), 0)) as result
