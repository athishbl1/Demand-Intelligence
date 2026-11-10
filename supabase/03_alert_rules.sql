-- team-07 alert subscriptions: the director picks alert types in the app (/alerts, "My alert rules"),
-- n8n checks the enabled rules every hour and on demand, and writes hits into team_07_alerts.
-- Idempotent, safe to re-run. RLS on, no anon policy: the app reads and writes only through n8n
-- (workflow "team-07 · Drop Watch & Investigate", webhook team-07-agent, actions rules / rule_save / rule_delete / check).
set search_path = public, extensions;

create table if not exists public.team_07_alert_rules (
  id bigint generated always as identity primary key,
  type text not null check (type in ('below_py', 'below_fc', 'forecast_below_py', 'low_occupancy', 'slow_bookings', 'data_gap')),
  threshold numeric not null check (threshold > 0 and threshold <= 100),
  label text,
  enabled boolean not null default true,
  last_checked_at timestamptz,
  last_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.team_07_alert_rules enable row level security;

-- Alerts raised by a rule carry the rule, its type and the computed numbers; AI-explained alerts keep rule_id null.
alter table public.team_07_alerts add column if not exists rule_id bigint references public.team_07_alert_rules (id) on delete set null;
alter table public.team_07_alerts add column if not exists alert_type text;
alter table public.team_07_alerts add column if not exists detail jsonb;
-- One alert per rule and period: the hourly check never raises the same alert twice.
create unique index if not exists team_07_alerts_rule_date_uq on public.team_07_alerts (rule_id, date) where rule_id is not null;

-- Two sensible defaults so the inbox works before anyone configures anything.
insert into public.team_07_alert_rules (type, threshold)
select t, th from (values ('below_py', 10::numeric), ('forecast_below_py', 15::numeric)) v(t, th)
where not exists (select 1 from public.team_07_alert_rules);

notify pgrst, 'reload schema';
