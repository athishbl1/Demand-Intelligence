-- team-07 Change Explainer agent (AGENT_PLAN.md): reports, explanations (versioned), feedback, alerts, settings.
-- Idempotent, safe to re-run. RLS on, no anon policy: the app reads and writes only through n8n
-- (workflow "team-07 · Drop Watch & Investigate", webhook team-07-agent).
set search_path = public, extensions;

-- Daily visitor reports sent by the scheduled caller (team_07_stays_daily stays read-only)
create table if not exists public.team_07_reports (
  id bigint generated always as identity primary key,
  date date not null,
  actual integer not null,
  forecast integer,
  source text not null default 'webhook',
  received_at timestamptz not null default now()
);
alter table public.team_07_reports enable row level security;
create index if not exists team_07_reports_date_idx on public.team_07_reports (date);

-- One row per version of an explanation; versions of the same question share scope_key
create table if not exists public.team_07_explanations (
  id bigint generated always as identity primary key,
  scope_key text not null,
  scope jsonb not null,
  version integer not null default 1,
  parent_id bigint references public.team_07_explanations (id),
  root_id bigint references public.team_07_explanations (id),
  change_type text not null,
  severity text,
  totals jsonb not null,
  facts jsonb not null,
  reasons jsonb not null default '[]'::jsonb,
  unexplained_pct numeric,
  headline text,
  caveat text,
  change_note text,
  model text,
  ai boolean not null default false,
  error text,
  data_updated_at timestamptz,
  answer jsonb,
  created_at timestamptz not null default now()
);
alter table public.team_07_explanations enable row level security;
create index if not exists team_07_explanations_scope_idx on public.team_07_explanations (scope_key, created_at desc);
create index if not exists team_07_explanations_root_idx on public.team_07_explanations (root_id);

-- Feedback on a whole explanation (reason_idx null) or on one reason
create table if not exists public.team_07_feedback (
  id bigint generated always as identity primary key,
  explanation_id bigint not null references public.team_07_explanations (id),
  reason_idx integer,
  vote smallint check (vote in (-1, 0, 1)),
  tags text[] not null default '{}',
  text text check (char_length(text) <= 500),
  ignore boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.team_07_feedback enable row level security;
create index if not exists team_07_feedback_expl_idx on public.team_07_feedback (explanation_id);

-- In-app alerts raised by the report path
create table if not exists public.team_07_alerts (
  id bigint generated always as identity primary key,
  explanation_id bigint references public.team_07_explanations (id),
  date date not null,
  scope_label text,
  change_type text not null,
  delta_pct numeric,
  severity text not null check (severity in ('high', 'medium', 'info', 'warning')),
  headline text,
  status text not null default 'unread' check (status in ('unread', 'read', 'dismissed')),
  created_at timestamptz not null default now()
);
alter table public.team_07_alerts enable row level security;
create index if not exists team_07_alerts_status_idx on public.team_07_alerts (status, created_at desc);

-- Settings: tolerance, alert thresholds, as-of date for the demo schedule
create table if not exists public.team_07_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.team_07_settings enable row level security;

insert into public.team_07_settings (key, value) values
  ('tolerance_pct', '5'),
  ('alert_py_pct', '-10'),
  ('alert_fc_pct', '-8'),
  ('max_versions', '5'),
  ('as_of_date', '"2026-04-19"')
on conflict (key) do nothing;

notify pgrst, 'reload schema';
