-- team-07 alert rules, reduced to three types (8 Nov 2026): forecast_below_py, slow_bookings, data_gap.
-- The holiday markets now appear inside the forecast_below_py alert. Idempotent, safe to re-run.
set search_path = public, extensions;

delete from public.team_07_alerts where alert_type in ('holiday_week_weak', 'season_below_py');
delete from public.team_07_alert_rules where type in ('holiday_week_weak', 'season_below_py');

alter table public.team_07_alert_rules drop constraint if exists team_07_alert_rules_type_check;
alter table public.team_07_alert_rules add constraint team_07_alert_rules_type_check
  check (type in ('forecast_below_py', 'slow_bookings', 'data_gap'));

notify pgrst, 'reload schema';
