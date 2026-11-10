-- team-07 reasoning engine: explainable driver model for overnight stays (see scripts/fit_driver_model.py).
-- Idempotent, safe to re-run. RLS on, no anon policy: only n8n (Postgres credential) and the fit script read/write.
set search_path = public, extensions;

-- Detected (or corrected) season opening and closing dates
create table if not exists public.team_07_season_dates (
  season text primary key,              -- e.g. 'winter 2025/26', 'summer 2026'
  kind text not null check (kind in ('winter', 'summer')),
  open_date date not null,
  close_date date not null,
  source text not null default 'detected',  -- 'detected' from the stays ramp, or 'manual'
  updated_at timestamptz not null default now()
);
alter table public.team_07_season_dates enable row level security;

-- One row per fitted model version: feature spec, coefficients, bootstrap samples, backtest and noise
create table if not exists public.team_07_driver_model (
  version text primary key,
  active boolean not null default false,
  spec jsonb not null,        -- {features: [names], groups: {name: group}}
  coef jsonb not null,        -- coefficients fitted on actual stays (log scale)
  coef_fc jsonb,              -- the same features fitted on the forecast series
  samples jsonb not null,     -- block-bootstrap coefficient samples (for confidence intervals)
  metrics jsonb not null,     -- backtest: MAPE per month, in-season MAPE, R2
  noise jsonb not null,       -- forecast error p50/p80 per month (daily and weekly)
  created_at timestamptz not null default now()
);
alter table public.team_07_driver_model enable row level security;

-- Feature values per date (history 2024-11 -> 2026-10 and forecast to 2027-04), aligned with spec.features
create table if not exists public.team_07_features_daily (
  date date primary key,
  model_version text not null,
  stays_hist integer,          -- stays on this date: actual (2025-11 on) or last-year column (2024/25)
  stays_fc integer,            -- forecast (2025-11 on)
  src text not null,           -- 'actual', 'history', 'forecast'
  x jsonb not null,            -- feature vector
  updated_at timestamptz not null default now()
);
alter table public.team_07_features_daily enable row level security;

notify pgrst, 'reload schema';
