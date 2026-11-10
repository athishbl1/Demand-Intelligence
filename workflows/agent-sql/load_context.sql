with i as (select convert_from(decode($1, 'base64'), 'UTF8')::jsonb as j),
settings as (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) as s from public.team_07_settings),
src as (
  select e.* from public.team_07_explanations e, i
  where i.j->>'action' = 'regenerate' and e.id = nullif(i.j->>'explanation_id', '')::bigint
),
asof as (select (s->>'as_of_date')::date as d from settings),
p as (
  select
    coalesce((select (scope->>'from')::date from src), (i.j->>'from')::date, (select d from asof)) as f,
    coalesce((select (scope->>'to')::date from src), (i.j->>'to')::date, (select d from asof)) as t
  from i
),
rep_ins as (
  insert into public.team_07_reports (date, actual, forecast, source)
  select p.f,
    coalesce(nullif(i.j->'report'->>'actual', '')::int, (select actual from public.team_07_stays_daily where date = p.f)),
    nullif(i.j->'report'->>'forecast', '')::int,
    coalesce(i.j->'report'->>'source', 'webhook')
  from i, p
  where i.j->>'action' = 'report' and coalesce(i.j->>'demo', 'false') <> 'true'
    and coalesce(nullif(i.j->'report'->>'actual', '')::int, (select actual from public.team_07_stays_daily where date = p.f)) is not null
  returning id, date, actual, forecast
),
rep_demo as (
  select null::bigint as id, p.f as date, nullif(i.j->'report'->>'actual', '')::int as actual,
    nullif(i.j->'report'->>'forecast', '')::int as forecast
  from i, p
  where i.j->>'action' = 'report' and i.j->>'demo' = 'true' and nullif(i.j->'report'->>'actual', '') is not null
),
rep as (select * from rep_ins union all select * from rep_demo),
fb_new as (
  insert into public.team_07_feedback (explanation_id, reason_idx, vote, tags, text, ignore)
  select (select id from src), nullif(x->>'reason_idx', '')::int, nullif(x->>'vote', '')::smallint,
    coalesce(array(select jsonb_array_elements_text(coalesce(x->'tags', '[]'::jsonb))), '{}'),
    left(nullif(x->>'text', ''), 500), coalesce((x->>'ignore')::boolean, false)
  from i, jsonb_array_elements(coalesce(i.j->'feedback', '[]'::jsonb)) x
  where i.j->>'action' = 'regenerate' and exists (select 1 from src)
  returning reason_idx, vote, tags, text, ignore
),
days as (
  select s.date, s.previous_year, s.forecast, s.actual, m.quality_flag, b.available_beds, s.updated_at
  from p, public.team_07_stays_daily s
  left join public.team_07_metrics_daily m on m.date = s.date
  left join public.team_07_free_beds b on b.date = s.date
  where s.date between p.f - 21 and p.t + 21
),
hol as (
  select per, market, count(distinct d)::int as days from (
    select 'now' as per, h.market, d::date as d
    from p, generate_series(p.f, p.t, interval '1 day') d, public.team_07_holidays h
    where h.type like 'school:%' and d::date between h.start_date and h.end_date
    union all
    select 'py', h.market, d::date
    from p, generate_series(p.f - 364, p.t - 364, interval '1 day') d, public.team_07_holidays h
    where h.type like 'school:%' and d::date between h.start_date and h.end_date
  ) x group by 1, 2
),
hol_cov as (select market, min(start_date) as since from public.team_07_holidays group by 1),
lead as (
  select per,
    sum(bookings_0_days_ahead + bookings_8_days_ahead)::int as short_lead,
    sum(bookings_0_days_ahead + bookings_8_days_ahead + bookings_31_days_ahead + bookings_61_days_ahead
        + bookings_90_days_ahead + bookings_180_days_ahead)::int as total,
    count(*)::int as weeks
  from (
    select 'now' as per, l.* from p, public.team_07_lead_time l
    where l.week_start between date_trunc('week', p.f)::date and p.t
    union all
    select 'py', l.* from p, public.team_07_lead_time l
    where l.week_start between date_trunc('week', p.f - 364)::date and p.t - 364
  ) x group by 1
),
wx as (
  select per, count(*)::int as days, round(avg(snow_depth_cm), 1) as snow_depth_avg,
    round(sum(snowfall_cm), 1) as snowfall_sum, round(avg(temp_max), 1) as temp_max_avg, round(sum(precip_mm), 1) as precip_sum
  from (
    select 'now' as per, w.* from p, public.team_07_weather_daily w where w.date between p.f and p.t
    union all
    select 'py', w.* from p, public.team_07_weather_daily w where w.date between p.f - 364 and p.t - 364
  ) x group by 1
),
ev as (
  select per, count(*)::int as events, count(*) filter (where top_event)::int as top_events,
    (array_agg(name order by top_event desc, date))[1:6] as names
  from (
    select 'now' as per, e.* from p, public.team_07_events e where e.date <= p.t and e.end_date >= p.f
    union all
    select 'py', e.* from p, public.team_07_events e where e.date <= p.t - 364 and e.end_date >= p.f - 364
  ) x group by 1
),
beds as (
  select per, round(avg(available_beds))::int as free_beds_avg, count(*)::int as days from (
    select 'now' as per, b.* from p, public.team_07_free_beds b where b.date between p.f and p.t
    union all
    select 'py', b.* from p, public.team_07_free_beds b where b.date between p.f - 364 and p.t - 364
  ) x group by 1
),
peers as (
  select region, reg_id, per, round(avg(index_value), 4) as idx, count(*)::int as days from (
    select 'now' as per, r.* from p, public.team_07_region_index r where r.date between p.f and p.t
    union all
    select 'py', r.* from p, public.team_07_region_index r where r.date between p.f - 364 and p.t - 364
  ) x group by 1, 2, 3
),
cached as (
  select e.answer, e.data_updated_at, e.id, coalesce(e.root_id, e.id) as root_id
  from public.team_07_explanations e, i
  where i.j->>'action' in ('explain', 'report') and e.scope_key = i.j->>'scope_key' and e.answer is not null
  order by e.created_at desc limit 1
),
root as (select coalesce((select coalesce(root_id, id) from src), (select root_id from cached)) as rid),
versions as (
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'version', e.version, 'change_note', e.change_note,
    'created_at', e.created_at) order by e.version), '[]'::jsonb) as v
  from public.team_07_explanations e, root where coalesce(e.root_id, e.id) = root.rid
),
fb_old as (
  select coalesce(jsonb_agg(jsonb_build_object('explanation_id', f.explanation_id, 'reason_idx', f.reason_idx,
    'vote', f.vote, 'tags', f.tags, 'text', f.text, 'ignore', f.ignore) order by f.id), '[]'::jsonb) as v
  from public.team_07_feedback f
  join public.team_07_explanations e on e.id = f.explanation_id, root
  where coalesce(e.root_id, e.id) = root.rid
)
select jsonb_build_object(
  'from', p.f, 'to', p.t,
  'settings', (select s from settings),
  'report', (select to_jsonb(rep) from rep),
  'days', (select coalesce(jsonb_agg(to_jsonb(days) - 'updated_at' order by date), '[]'::jsonb) from days),
  'data_updated_at', (select max(updated_at) from days where date between p.f and p.t),
  'holidays', (select coalesce(jsonb_agg(to_jsonb(hol)), '[]'::jsonb) from hol),
  'holiday_coverage', (select jsonb_object_agg(market, since) from hol_cov),
  'lead', (select coalesce(jsonb_object_agg(per, to_jsonb(lead) - 'per'), '{}'::jsonb) from lead),
  'weather', (select coalesce(jsonb_object_agg(per, to_jsonb(wx) - 'per'), '{}'::jsonb) from wx),
  'events', (select coalesce(jsonb_object_agg(per, to_jsonb(ev) - 'per'), '{}'::jsonb) from ev),
  'beds', (select coalesce(jsonb_object_agg(per, to_jsonb(beds) - 'per'), '{}'::jsonb) from beds),
  'peers', (select coalesce(jsonb_agg(to_jsonb(peers)), '[]'::jsonb) from peers),
  'src', (select to_jsonb(src) - 'answer' from src),
  'src_answer', (select answer from src),
  'versions', (select v from versions),
  'feedback', (select v from fb_old),
  'feedback_new', (select coalesce(jsonb_agg(to_jsonb(fb_new)), '[]'::jsonb) from fb_new),
  'cached', (select to_jsonb(cached) from cached)
) as result
from p
