-- team-07 Campaign Strategist agent (Phase 3): strategy sets (versioned) and feedback on them.
-- Idempotent, safe to re-run. RLS on, no anon policy: the app reads and writes only through n8n
-- (workflow "team-07 · Campaign Strategist", webhook team-07-strategy).
set search_path = public, extensions;

-- One row per version of a strategy set; versions of the same set share root_id (null on v1 = itself)
create table if not exists public.team_07_strategy_sets (
  id bigint generated always as identity primary key,
  explanation_id bigint not null references public.team_07_explanations (id),
  version integer not null default 1,
  parent_id bigint references public.team_07_strategy_sets (id),
  root_id bigint references public.team_07_strategy_sets (id),
  mode text not null check (mode in ('recover', 'capitalise', 'monitor', 'none')),
  target jsonb not null,
  context jsonb not null,
  strategies jsonb not null default '[]'::jsonb,
  custom jsonb,
  change_note text,
  model text,
  ai boolean not null default false,
  error text,
  answer jsonb,
  status text not null default 'open' check (status in ('open', 'accepted', 'dismissed')),
  accepted_idx integer check (accepted_idx between 0 and 3),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.team_07_strategy_sets enable row level security;
create index if not exists team_07_strategy_sets_expl_idx on public.team_07_strategy_sets (explanation_id, created_at desc);
create index if not exists team_07_strategy_sets_root_idx on public.team_07_strategy_sets (root_id);

-- Feedback on a whole set (strategy_idx null) or on one strategy (0-2; 3 = the user's own strategy)
create table if not exists public.team_07_strategy_feedback (
  id bigint generated always as identity primary key,
  set_id bigint not null references public.team_07_strategy_sets (id),
  strategy_idx integer check (strategy_idx between 0 and 3),
  vote smallint check (vote in (-1, 0, 1)),
  tags text[] not null default '{}',
  text text check (char_length(text) <= 500),
  ignore boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.team_07_strategy_feedback enable row level security;
create index if not exists team_07_strategy_feedback_set_idx on public.team_07_strategy_feedback (set_id);

notify pgrst, 'reload schema';
