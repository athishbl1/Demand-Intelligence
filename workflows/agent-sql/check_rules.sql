-- n8n Postgres node "Check rules": evaluates every enabled alert rule from TODAY into the coming season, so each
-- alert leads to an action. "Today" = team_07_settings.rules_today if set (stable demo), else current_date.
-- Every alert on a coming week carries an act-by date from the booking lead-time mix (team_07_lead_time).
-- One alert per rule and period (unique index), all numbers computed here.
with t as (
  select coalesce((select (value #>> '{}')::date from public.team_07_settings where key = 'rules_today'), current_date) as today
),
r as (select * from public.team_07_alert_rules where enabled),
lbs as (  -- bookings per lead-time bucket over all weeks (lower bound of the bucket in days)
  select v.lo, sum(coalesce(v.n, 0))::numeric as n
  from public.team_07_lead_time l
  cross join lateral (values (0, l.bookings_0_days_ahead), (8, l.bookings_8_days_ahead), (31, l.bookings_31_days_ahead),
                             (61, l.bookings_61_days_ahead), (90, l.bookings_90_days_ahead), (180, l.bookings_180_days_ahead)) v(lo, n)
  group by v.lo
),
lead as (  -- at least half of all bookings come this many days ahead or more: act before that
  select max(a.lo) as days from lbs a
  where (select sum(b.n) from lbs b where b.lo >= a.lo) >= 0.5 * (select sum(n) from lbs)
),
wk as (  -- coming weeks (starting today or later) with real volume last year
  select date_trunc('week', d.date)::date as wk, sum(d.forecast) as fc, sum(d.previous_year) as py
  from public.team_07_stays_daily d, t
  where date_trunc('week', d.date)::date >= t.today
  group by 1
  having sum(d.previous_year) >= 1000
),
wk2 as (
  select w.wk, w.fc, w.py, round(100.0 * (w.fc - w.py) / w.py, 1) as pct,
    w.wk - (select days from lead) as act_by, (select days from lead) as lead_days, w.wk - t.today as days_left,
    round(100.0 * (select coalesce(sum(n), 0) from lbs where lo < w.wk - t.today) / nullif((select sum(n) from lbs), 0)) as reachable_pct,
    (select array_agg(distinct h.market order by h.market) from public.team_07_holidays h
      where h.type like 'school%' and h.start_date <= w.wk + 6 and h.end_date >= w.wk) as markets
  from wk w, t
),
lt as (  -- latest booking week up to today vs the average of the 4 weeks before
  select x.week_start, x.tot, x.prev4 from (
    select b.week_start, b.tot, avg(b.tot) over (order by b.week_start rows between 4 preceding and 1 preceding) as prev4
    from (select week_start, coalesce(bookings_0_days_ahead, 0) + coalesce(bookings_8_days_ahead, 0) + coalesce(bookings_31_days_ahead, 0)
            + coalesce(bookings_61_days_ahead, 0) + coalesce(bookings_90_days_ahead, 0) + coalesce(bookings_180_days_ahead, 0) as tot
          from public.team_07_lead_time) b
  ) x, t
  where x.week_start <= t.today
  order by x.week_start desc limit 1
),
gap as (  -- coming 8 weeks: no forecast, or a zero forecast where last year had guests
  select count(*) as n, min(d.date) as d_from, max(d.date) as d_to
  from public.team_07_stays_daily d, t
  where d.date >= t.today and d.date < t.today + 56
    and (d.forecast is null or (d.forecast = 0 and coalesce(d.previous_year, 0) > 0))
),
cand as (
  select r.id as rule_id, r.type, r.threshold, w.wk as date,
    'Week of ' || to_char(w.wk, 'FMDD Mon YYYY') || coalesce(' · holidays ' || array_to_string(w.markets, ', '), '') as label, w.pct as value,
    w.act_by, w.reachable_pct, w.lead_days,
    format('The forecast for the week of %s is %s %% below last year (%s vs %s stays).', to_char(w.wk, 'FMDD Mon'), abs(w.pct),
      to_char(w.fc, 'FM999,999,999'), to_char(w.py, 'FM999,999,999'))
      || coalesce(format(' School holidays in %s: target these markets.', array_to_string(w.markets, ', ')), '') as what,
    jsonb_build_object('metric', 'forecast vs last year', 'forecast', w.fc, 'reference', w.py, 'from', w.wk, 'to', w.wk + 6,
      'act_by', w.act_by, 'days_left', w.days_left, 'lead_days', w.lead_days, 'reachable_pct', w.reachable_pct, 'markets', to_jsonb(w.markets)) as detail
  from r, wk2 w where r.type = 'forecast_below_py'
  union all
  select r.id, r.type, r.threshold, l.week_start, 'Bookings, week of ' || to_char(l.week_start, 'FMDD Mon YYYY'),
    round(100.0 * (l.tot - l.prev4) / l.prev4, 1), null::date, null::numeric, null::int,
    format('New bookings in the week of %s were %s %% below the 4-week average (%s vs %s). Check prices and push the coming weeks now.',
      to_char(l.week_start, 'FMDD Mon'), abs(round(100.0 * (l.tot - l.prev4) / l.prev4, 1)), l.tot, round(l.prev4)),
    jsonb_build_object('metric', 'vs 4-week average', 'bookings', l.tot, 'reference', round(l.prev4), 'from', l.week_start, 'to', l.week_start + 6)
  from r, lt l where r.type = 'slow_bookings' and l.prev4 >= 100  -- thin weeks (off-season, incomplete latest week) are noise
  union all
  select r.id, r.type, r.threshold, coalesce(g.d_from, t.today), case when g.n > 0 then to_char(g.d_from, 'FMDD Mon') || ' – ' || to_char(g.d_to, 'FMDD Mon YYYY') else 'Next 8 weeks' end,
    g.n::numeric, null::date, null::numeric, null::int,
    format('%s coming days have no forecast although last year had guests. Ask for an updated forecast before planning campaigns.', g.n),
    jsonb_build_object('metric', 'days without forecast', 'from', coalesce(g.d_from, t.today), 'to', coalesce(g.d_to, t.today + 55))
  from r, gap g, t where r.type = 'data_gap'
),
ev as (
  select c.*, case when c.type = 'data_gap' then c.value >= c.threshold else c.value <= -c.threshold end as fire
  from cand c where c.value is not null
),
hit as (
  select ev.*,
    case when ev.type = 'data_gap' then 'warning'
         when ev.value <= -2 * ev.threshold or (ev.act_by is not null and ev.act_by <= (select today from t) + 7) then 'high'
         else 'medium' end as severity,
    case when ev.type = 'data_gap' then 'data_issue' else 'forecast_drop' end as change_type,
    ev.what || ' ' || case
      when ev.act_by is null then format('Your alert starts at %s %s.', ev.threshold, case when ev.type = 'data_gap' then 'days' else '%' end)
      when ev.act_by >= (select today from t) then format('Act by %s: half of the guests book %s days or more ahead.', to_char(ev.act_by, 'FMDD Mon'), ev.lead_days)
      else format('The main booking window has passed: about %s %% of bookings usually still come in, so use last-minute offers.', ev.reachable_pct)
    end as headline
  from ev where ev.fire
),
ins as (
  insert into public.team_07_alerts (rule_id, alert_type, date, scope_label, change_type, delta_pct, severity, headline, detail)
  select rule_id, type, date, label, change_type, value, severity, headline, detail || jsonb_build_object('threshold', threshold) from hit
  on conflict do nothing
  returning id, rule_id
),
res as (
  select e.rule_id, jsonb_build_object('as_of', (select today from t), 'hits', count(*) filter (where e.fire),
    'periods', jsonb_agg(jsonb_build_object('date', e.date, 'label', e.label, 'value', e.value, 'fire', e.fire, 'act_by', e.act_by) order by e.date)) as j
  from ev e group by e.rule_id
),
upd as (
  update public.team_07_alert_rules a set last_checked_at = now(),
    last_result = coalesce(res.j, jsonb_build_object('as_of', (select today from t), 'hits', 0, 'periods', '[]'::jsonb))
  from r left join res on res.rule_id = r.id
  where a.id = r.id
  returning a.id
)
select jsonb_build_object(
  'ok', true,
  'as_of_date', (select today from t),
  'lead_days', (select days from lead),
  'checked_rules', (select count(*) from upd),
  'new_alerts', (select count(*) from ins),
  'unread', (select count(*) from public.team_07_alerts where status = 'unread') + (select count(*) from ins),
  'rules', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'type', a.type, 'threshold', a.threshold, 'label', a.label, 'enabled', a.enabled, 'created_at', a.created_at,
      'last_checked_at', case when a.enabled then now() else a.last_checked_at end,
      'last_result', case when a.enabled then coalesce((select j from res where res.rule_id = a.id), jsonb_build_object('hits', 0, 'periods', '[]'::jsonb)) else a.last_result end,
      'alerts_open', (select count(*) from public.team_07_alerts x where x.rule_id = a.id and x.status <> 'dismissed') + (select count(*) from ins where ins.rule_id = a.id)
    ) order by a.created_at) from public.team_07_alert_rules a), '[]'::jsonb),
  'checked_at', now()
) as result
