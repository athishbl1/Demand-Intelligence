-- team-07 alert rules, forward-looking only (8 Nov 2026): alerts must lead to an action, so every rule now looks
-- from today into the coming season. Removes the past-only types (below_py, below_fc, low_occupancy) and adds
-- holiday_week_weak and season_below_py. Idempotent, safe to re-run.
-- Optional: team_07_settings key 'rules_today' pins "today" for a stable demo; without it the check uses current_date.
set search_path = public, extensions;

-- old alerts were raised against the April demo date: nothing can be done about them any more
update public.team_07_alerts set status = 'dismissed'
where alert_type in ('below_py', 'below_fc', 'low_occupancy')
   or (alert_type is not null and created_at < '2026-11-08 02:00+00' and status <> 'dismissed');

delete from public.team_07_alert_rules where type in ('below_py', 'below_fc', 'low_occupancy');

alter table public.team_07_alert_rules drop constraint if exists team_07_alert_rules_type_check;
alter table public.team_07_alert_rules add constraint team_07_alert_rules_type_check
  check (type in ('forecast_below_py', 'holiday_week_weak', 'season_below_py', 'slow_bookings', 'data_gap'));

-- sensible defaults for the coming winter
update public.team_07_alert_rules set threshold = 8, updated_at = now() where type = 'forecast_below_py' and threshold = 15;
insert into public.team_07_alert_rules (type, threshold)
select v.t, v.th from (values ('holiday_week_weak', 5::numeric), ('season_below_py', 3::numeric)) v(t, th)
where not exists (select 1 from public.team_07_alert_rules x where x.type = v.t);

notify pgrst, 'reload schema';
