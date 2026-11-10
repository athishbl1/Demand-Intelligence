-- team-07 Demand Detective: stage 1 schema (idempotent, safe to re-run)
-- Run by scripts/migrate_to_supabase.py (psql) or through the n8n Postgres node.
set search_path = public, extensions;

-- Daily overnight stays: previous year, forecast, actual (TVB Paznaun-Ischgl, Feratel)
create table if not exists public.team_07_stays_daily (
  date date primary key,
  previous_year integer,
  forecast integer,
  actual integer,
  updated_at timestamptz not null default now()
);
alter table public.team_07_stays_daily enable row level security;

-- Free beds left per day (NOT total capacity)
create table if not exists public.team_07_free_beds (
  date date primary key,
  available_beds integer,
  updated_at timestamptz not null default now()
);
alter table public.team_07_free_beds enable row level security;

-- Weekly booking counts by lead-time bucket, whole valley (no market split in the source)
create table if not exists public.team_07_lead_time (
  week_start date primary key,
  bookings_0_days_ahead integer,
  bookings_8_days_ahead integer,
  bookings_31_days_ahead integer,
  bookings_61_days_ahead integer,
  bookings_90_days_ahead integer,
  bookings_180_days_ahead integer,
  updated_at timestamptz not null default now()
);
alter table public.team_07_lead_time enable row level security;

-- Events: TVB calendar (one row per day) + Contwise events (village + top_event flag), merged
create table if not exists public.team_07_events (
  id bigint generated always as identity primary key,
  date date not null,
  end_date date not null,
  village text,
  name text not null,
  top_event boolean not null default false,
  source text not null check (source in ('tvb', 'contwise')),
  updated_at timestamptz not null default now()
);
alter table public.team_07_events enable row level security;
create index if not exists team_07_events_date_idx on public.team_07_events (date);

-- Listed beds per village (Contwise, aggregated to totals only -- no host names/contacts)
create table if not exists public.team_07_village_beds (
  village text primary key,
  beds integer not null,
  host_count integer not null,
  updated_at timestamptz not null default now()
);
alter table public.team_07_village_beds enable row level security;

-- Daily normalised overnight index, Paznaun-Ischgl (R54) + 4 peer ski regions, for benchmarking
create table if not exists public.team_07_region_index (
  date date not null,
  region text not null,
  reg_id text not null,
  index_value numeric not null,
  primary key (date, reg_id)
);
alter table public.team_07_region_index enable row level security;

-- Added in stage 3 (filled by n8n calling the OpenHolidays / Open-Meteo APIs, not from data/ files)
create table if not exists public.team_07_holidays (
  id bigint generated always as identity primary key,
  market text not null,
  region text,
  start_date date not null,
  end_date date not null,
  type text,
  updated_at timestamptz not null default now()
);
alter table public.team_07_holidays enable row level security;

create table if not exists public.team_07_weather_daily (
  date date not null,
  location text not null,
  temp_max numeric,
  temp_min numeric,
  precip_mm numeric,
  snowfall_cm numeric,
  snow_depth_cm numeric,
  primary key (date, location)
);
alter table public.team_07_weather_daily enable row level security;

-- Computed view: gaps, occupancy proxy, data-quality flag. Recalculated on every read, not stored.
create or replace view public.team_07_metrics_daily
with (security_invoker = true) as
select
  s.date,
  s.actual,
  s.forecast,
  s.previous_year,
  b.available_beds,
  case when (s.actual + coalesce(b.available_beds, 0)) > 0
    then round(s.actual::numeric / (s.actual + coalesce(b.available_beds, 0)), 4)
  end as occupancy,
  s.actual - s.forecast as gap_fc,
  case when s.forecast > 0 then round((s.actual - s.forecast)::numeric / s.forecast * 100, 1) end as gap_fc_pct,
  s.actual - s.previous_year as gap_py,
  case when s.previous_year > 0 then round((s.actual - s.previous_year)::numeric / s.previous_year * 100, 1) end as gap_py_pct,
  case
    when s.forecast = 0 then 'red'
    when s.forecast > 0 and abs(s.actual - s.forecast)::numeric / s.forecast > 0.4 then 'yellow'
    else 'green'
  end as quality_flag
from public.team_07_stays_daily s
left join public.team_07_free_beds b on b.date = s.date;

notify pgrst, 'reload schema';
