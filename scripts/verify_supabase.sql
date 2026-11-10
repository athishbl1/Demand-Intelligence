-- team-07: verify the migration. Run with:
--   psql "$(grep '^SUPABASE_DB_URL=' .env.local | cut -d= -f2-)" -f scripts/verify_supabase.sql

\echo '== 1. Tables and views of team_07 (RLS on?) =='
select c.relname as name,
       case c.relkind when 'r' then 'table' when 'v' then 'view' end as kind,
       c.relrowsecurity as rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname like 'team\_07\_%' and c.relkind in ('r','v')
order by kind, name;

\echo '== 2. Row counts (expected: stays 517, free_beds 640, lead_time 153, events 246 (146 tvb + 100 contwise date ranges), village_beds 6, region_index 7305, holidays ~699 (after --enrich), weather ~384 (archive + 16-day forecast)) =='
select 'team_07_stays_daily' as tbl, count(*) from public.team_07_stays_daily
union all select 'team_07_free_beds', count(*) from public.team_07_free_beds
union all select 'team_07_lead_time', count(*) from public.team_07_lead_time
union all select 'team_07_events', count(*) from public.team_07_events
union all select 'team_07_village_beds', count(*) from public.team_07_village_beds
union all select 'team_07_region_index', count(*) from public.team_07_region_index
union all select 'team_07_holidays', count(*) from public.team_07_holidays
union all select 'team_07_weather_daily', count(*) from public.team_07_weather_daily
union all select 'team_07_metrics_daily (view)', count(*) from public.team_07_metrics_daily;

\echo '== 3. Date ranges and red days (expected: 517 days 2025-11-04..2027-04-04, 17 red) =='
select min(date), max(date), count(*) as days,
       count(*) filter (where quality_flag = 'red') as red_days,
       count(*) filter (where quality_flag = 'yellow') as yellow_days,
       max(date) filter (where actual is not null) as last_actual
from public.team_07_metrics_daily;

\echo '== 4. Winter 2025/26 KPIs (Nov 2025 - Apr 2026) =='
\echo '   NOTE: PLAN.md expects actual 2,349,142 / forecast 2,409,874; my calculation from the CSV gives 2,327,418 / 2,389,831 for this window -> reconcile the window.'
select sum(actual) as actual, sum(forecast) as forecast, sum(previous_year) as prev_year,
       round((sum(actual) - sum(forecast))::numeric / sum(forecast) * 100, 1) as gap_fc_pct,
       round((sum(actual) - sum(previous_year))::numeric / sum(previous_year) * 100, 1) as gap_py_pct
from public.team_07_metrics_daily
where date between '2025-11-01' and '2026-04-30';

\echo '== 5. Forecast-zero days (red) =='
select date, forecast, previous_year, actual from public.team_07_metrics_daily
where quality_flag = 'red' order by date;

\echo '== 6. Village beds (expected total 22,227; Ischgl 10,176) =='
select village, beds, host_count from public.team_07_village_beds order by beds desc;
select sum(beds) as total_beds, sum(host_count) as hosts from public.team_07_village_beds;

\echo '== 7. Events by source (expected: contwise 69 distinct events, 31 top events) =='
select source,
       count(*) as rows,
       count(distinct name) as distinct_events,
       count(distinct name) filter (where top_event) as top_events,
       min(date) as first_day, max(end_date) as last_day
from public.team_07_events group by source order by source;

\echo '== 8. Region index (5 regions) =='
select reg_id, region, count(*) as days, min(date), max(date), round(avg(index_value), 3) as avg_idx
from public.team_07_region_index group by reg_id, region order by reg_id;

\echo '== 9. Lead time, free beds sample =='
select * from public.team_07_lead_time order by week_start desc limit 3;
select * from public.team_07_free_beds order by date desc limit 3;
