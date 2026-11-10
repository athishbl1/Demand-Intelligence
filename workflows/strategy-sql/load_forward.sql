-- Forward context for the target window (computed in "Plan target"): weeks around it, holidays per market,
-- events, booking lead-time mix of the reference period, beds per village, free beds.
with i as (select convert_from(decode($1, 'base64'), 'UTF8')::jsonb as j),
p as (
  select (j->'target'->>'from')::date as f, (j->'target'->>'to')::date as t,
         (j->'target'->>'from')::date - 14 as nf, (j->'target'->>'to')::date + 14 as nt,
         (j->'lead_ref'->>'from')::date as lf, (j->'lead_ref'->>'to')::date as lt
  from i
),
wk as (
  select to_char(s.date, 'IYYY-"W"IW') as week, min(s.date) as week_start, max(s.date) as week_end,
    sum(s.forecast)::int as forecast, sum(s.previous_year)::int as previous_year, sum(s.actual)::int as actual,
    count(*) filter (where s.actual is not null)::int as days_with_actual, count(*)::int as days,
    bool_or(s.date between p.f and p.t) as in_target
  from p, public.team_07_stays_daily s where s.date between p.nf and p.nt group by 1 order by 2
),
hol as (
  select h.market, count(distinct d)::int as days, min(h.start_date) as first_start, max(h.end_date) as last_end,
    count(distinct coalesce(h.region, '-'))::int as regions,
    (array_agg(distinct split_part(h.type, ': ', 2)))[1:3] as kinds
  from p, generate_series(p.f, p.t, interval '1 day') d, public.team_07_holidays h
  where h.type like 'school:%' and d::date between h.start_date and h.end_date
  group by 1
),
hol_cov as (select market, min(start_date) as since, max(end_date) as until from public.team_07_holidays group by 1),
ev as (
  select e.date, e.end_date, e.village, e.name, e.top_event
  from p, public.team_07_events e
  where e.date <= p.t and e.end_date >= p.f and e.end_date - e.date <= 14
    and not (e.source = 'tvb' and exists (select 1 from public.team_07_events c where c.source = 'contwise' and c.date = e.date and c.top_event))
  order by e.top_event desc, e.date limit 10
),
lead as (
  select sum(bookings_0_days_ahead)::int as b0, sum(bookings_8_days_ahead)::int as b8, sum(bookings_31_days_ahead)::int as b31,
    sum(bookings_61_days_ahead)::int as b61, sum(bookings_90_days_ahead)::int as b90, sum(bookings_180_days_ahead)::int as b180,
    count(*)::int as weeks, min(week_start) as from_week, max(week_start) as to_week
  from p, public.team_07_lead_time l where l.week_start between date_trunc('week', p.lf)::date and p.lt
),
vb as (select village, beds, host_count from public.team_07_village_beds order by beds desc),
free as (select round(avg(available_beds))::int as free_beds_avg, count(*)::int as days from p, public.team_07_free_beds b where b.date between p.f and p.t)
select jsonb_build_object(
  'weeks', (select coalesce(jsonb_agg(to_jsonb(wk) order by week_start), '[]'::jsonb) from wk),
  'holidays', (select coalesce(jsonb_agg(to_jsonb(hol) order by days desc), '[]'::jsonb) from hol),
  'holiday_coverage', (select jsonb_object_agg(market, jsonb_build_object('since', since, 'until', until)) from hol_cov),
  'events', (select coalesce(jsonb_agg(to_jsonb(ev)), '[]'::jsonb) from ev),
  'lead', (select to_jsonb(lead) from lead),
  'beds', (select jsonb_agg(to_jsonb(vb) order by vb.beds desc) from vb),
  'free_beds', (select to_jsonb(free) from free where free.days > 0),
  'forecast_until', (select max(date) from public.team_07_stays_daily where forecast is not null)
) as result
