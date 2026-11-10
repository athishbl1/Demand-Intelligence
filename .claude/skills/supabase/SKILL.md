---
name: supabase
description: The shared Supabase of the TTF Hackathon, self-hosted by the organisers for all teams at https://supabase.ttf.buildbar.at (Postgres 15 with pgvector, PostGIS and pg_trgm, plus REST, Auth, Storage, Studio). No sign-up, and n8n already holds the credentials "TTF Supabase" and "TTF Supabase Postgres". Covers when to use it instead of Data Tables, the naming rule for a database all teams share, where the keys are, tables from SQL files in supabase/ with Row Level Security (run through the n8n Postgres node without a key, or through /pg/query, psql or the Studio), the Supabase, HTTP Request and Postgres nodes, supabase-js with the anon key in the app, test logins, file storage, vector search, geodata, limits and pitfalls. Use when the team needs more than small Data Tables (larger data, SQL with joins, vector search, geodata, logins, files), when a Data Table write fails because the shared size limit is full, or when the team asks about Supabase, Postgres or a database.
---

# Supabase (shared database of the event)

The organisers host one Supabase for all teams on the event server: Postgres 15.8 with pgvector, PostGIS and pg_trgm, plus REST API, Auth, Storage, Realtime and the Studio dashboard. It is ready to use. Nobody creates a project or an account at supabase.com, nothing needs to be set up, and every challenge account in n8n already holds the credentials. It is meant for prototypes, not for production data.

| Need | Use |
|---|---|
| Small lists, caches, intermediate results | n8n Data Table, the default (skill `data-catalog`) |
| Larger datasets, SQL with joins or aggregates, vector search, geodata, test logins, files, an app that reads a table directly | the shared Supabase |

Decide with the team before the first table and note it in `PLAN.md`.

## One database for all teams

- **Prefix every object** with the slot id from `team.md` in underscore form: tables, views, functions, policies, indexes, types, sequences and triggers. `team-07` becomes `team_07_`, for example `team_07_places`, `team_07_match_documents`, `team_07_places_read`, `team_07_places_town_idx`. The slot `test` becomes `test_`. Without the prefix a name can already belong to another team: `create index if not exists` then skips silently and `create type` fails.
- **Storage buckets** carry the slot id with hyphens: `team-07-photos`.
- **Never change or delete objects of other teams**, even though the Studio and the keys reach them.
- **Backup:** the whole database is saved every hour on the server, the last 48 copies are kept. Restores go through the organisers: ask at the buildbar_ desk.
- **Prototype data only:** public or invented data, no personal data, no real people as users.

## Access

| What | Where |
|---|---|
| Base URL | `https://supabase.ttf.buildbar.at` |
| REST API | `/rest/v1/<table>`, functions at `/rest/v1/rpc/<function>` |
| Auth, Storage, Realtime | `/auth/v1`, `/storage/v1`, Realtime through `supabase-js` |
| SQL over HTTPS | `POST /pg/query` with the service_role key |
| Studio (dashboard) | the base URL in the browser, HTTP Basic Auth with the Studio user and password |
| Postgres (pooler) | host `supabase.ttf.buildbar.at`, port `5432` (session mode: psql, migrations, DBeaver, ORMs) or `6543` (transaction mode), database `postgres`, user `postgres.ttf`, TLS with a self-signed certificate (`sslmode=require`) |
| n8n | credentials "TTF Supabase" and "TTF Supabase Postgres" in every challenge account |

The keys (anon, service_role), the Studio login and the Postgres connection are in the access area `https://buildbar.at/ttf-2026#access`, behind the event code you get on site. People open it. For work in n8n, SQL included, the agent needs none of them.

| Key | Where it may go |
|---|---|
| anon | Public by design: every participant has it, and it may pass through the chat. In the app only as `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Row Level Security applies to it. |
| service_role, Postgres password | Both bypass Row Level Security. Only in the n8n credentials (ready) and in `.env.local` in the repository root for SQL from your session (handed over once, see below). Never in the app, `frontend-starter/`, a commit, `team.md`, `PLAN.md` or workflow JSON, and never printed. |

**SQL from your own session** (optional, for `/pg/query` and psql): a team member hands you the service_role key or the Postgres connection from the access area once. Where they can, they type it into `.env.local` in the repository root themselves; otherwise they paste it once into the chat, the only secret that may pass through it, and you write the file with your file tool (Write, Edit or apply_patch). Never write it with `echo`, `printf` or a heredoc: the shell can change characters such as `$` or `!`, and the value would stand in the command. The file is listed in `.gitignore`; do not put these values into `frontend-starter/`.

```
# .env.local in the repository root, never committed
SUPABASE_URL=https://supabase.ttf.buildbar.at
SUPABASE_SERVICE_ROLE_KEY='<service_role>'
SUPABASE_DB_URL='postgresql://postgres.ttf:<password>@supabase.ttf.buildbar.at:5432/postgres?sslmode=require'
```

- Keep the single quotes. Characters such as `@`, `:`, `/` or `'` in the password must be percent-encoded in the URL (`'` as `%27`), otherwise the URL or the quotes break.
- The commands below are for bash (Git Bash on Windows, not PowerShell). Save `.env.local` with LF line endings: with CRLF every value ends in a hidden `\r`, which breaks the key and the URL.
- Load the values in the same shell call as the command that uses them (agent shells do not keep variables between calls): `set -a; . ./.env.local; set +a`.
- Use only the variables in commands. Never print the values: no `cat .env.local`, no `echo "$SUPABASE_SERVICE_ROLE_KEY"`, no `env` or `printenv`.

## Create tables

The schema lives in the repository as numbered files: `supabase/001-schema.sql`, later changes as new files such as `supabase/002-ratings.sql`, each run once and in order. Commit them; they hold no keys.

```sql
-- supabase/001-schema.sql
set search_path = public, extensions;

create table if not exists public.team_07_places (
  id bigint generated always as identity primary key,
  source_id text unique,
  name text not null,
  town text,
  category text,
  rating numeric,
  updated_at timestamptz not null default now()
);
alter table public.team_07_places enable row level security;

-- Only if the app reads this table with the anon key:
drop policy if exists team_07_places_read on public.team_07_places;
create policy team_07_places_read on public.team_07_places
  for select to anon, authenticated using (true);

notify pgrst, 'reload schema';
```

- **`enable row level security` right after every `create table`.** Without it anyone with the anon key can read and write the table, and the anon key is public: every participant has it, and it is in every app that uses `supabase-js`. n8n (service_role and the Postgres user) bypasses Row Level Security and keeps working.
- **Check Row Level Security without a key:** in the same SQL run (n8n workflow with "TTF Supabase Postgres"), `begin; set local role anon; select count(*) from public.team_07_places; rollback;` shows what the public anon key would see (0 rows without a read policy). Tried in the rehearsal on 7 November.
- **Read policies name `anon, authenticated`.** With `to anon` alone, users signed in to the app (see "Test logins") run as `authenticated` and get no rows, without an error. This opens nothing extra: anyone can create a test account.
- No `grant` lines needed: the default privileges cover anon, authenticated and service_role. Extra grants do no harm.
- Installed in the schema `extensions`, no `create extension` needed: `vector` 0.8.0, `postgis` 3.3.7, `pg_trgm` 1.6. `set search_path = public, extensions;` at the top lets you write their types without the schema and holds for the whole query string. Without it write `extensions.vector(1536)` and `extensions.geography(Point, 4326)`.
- `notify pgrst, 'reload schema';` at the end, so the REST API knows new tables and functions at once.
- Lower case names with underscores. The database creates `id`; keep the id of a source in its own column such as `source_id`.

### Run the SQL

Objects belong to the role that created them: `postgres` through n8n and psql, `supabase_admin` through `/pg/query`. Changing an object (`alter`, `drop`, policies) needs its owner role, so pick one way with the first table and stay with it. The default is n8n: it needs no key in your session. If the team prefers to hand you the service_role key, `/pg/query` is the quickest way.

**n8n (default, no key in your session):** one workflow `team-07 · SQL` with a Webhook node (POST, path `team-07-sql`, `responseMode: "lastNode"`) and a Postgres node with the credential "TTF Supabase Postgres" (see "In n8n" below), operation `executeQuery`, the content of the SQL file as query.

1. The SQL sits in the node. Never take it from the request body: such a webhook would let anyone run SQL on the database of all teams.
2. Activate the workflow, start it with `n8n_test_workflow` and check the result in the execution (`n8n_executions`).
3. Deactivate it right after the run and keep it for the next file: replace the query and repeat. Workflows cannot be deleted through the connection.

One query can hold a whole file with several statements: tested on 7 November from the one.intelligence n8n with `set search_path`, `create table` (with geography and vector columns), `enable row level security`, `create index`, `notify pgrst` and a final `select` in one query. The node returns the rows of the last `select`; the table belonged to `postgres`.

**curl to `/pg/query`** (key from `.env.local`). Several statements in one file are fine:

```bash
set -a; . ./.env.local; set +a
node -e 'process.stdout.write(JSON.stringify({query: require("fs").readFileSync(process.argv[1], "utf8")}))' supabase/001-schema.sql \
  | curl -sS -w '\nHTTP %{http_code}\n' "$SUPABASE_URL/pg/query" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" \
      --data-binary @-
```

A single query:

```bash
set -a; . ./.env.local; set +a
curl -sS -w '\nHTTP %{http_code}\n' "$SUPABASE_URL/pg/query" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "select count(*) from public.team_07_places"}'
```

The answer is HTTP 200 with the rows as JSON; the query runs as `supabase_admin`. HTTP 403: the anon key was used instead of service_role. Any other error status: read the message in the answer, and check the key in `.env.local` without printing it.

**psql** (if installed):

```bash
set -a; . ./.env.local; set +a
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/001-schema.sql
```

**Studio:** a team member opens `https://supabase.ttf.buildbar.at` and signs in with the Studio login. The Table Editor shows the rows, the SQL Editor runs SQL. The login was checked on 7 November, the editors were not; objects from the SQL Editor probably belong to `supabase_admin`, as through `/pg/query`.

## In n8n

| Credential | Type | For |
|---|---|---|
| "TTF Supabase" | `supabaseApi`: host and service_role, works only for `supabase.ttf.buildbar.at` | Supabase node, HTTP Request to the REST API, Supabase Vector Store |
| "TTF Supabase Postgres" | `postgres`: pooler port 5432, SSL require, certificate errors ignored | Postgres node, any SQL including `create table` |

Reference them by exact name and type with `"id": null`, as described under "Referencing a credential" in skill `data-catalog`, and check afterwards with `n8n_get_workflow` that the credential got an id:

```json
"credentials": {"supabaseApi": {"id": null, "name": "TTF Supabase"}}
```

```json
"credentials": {"postgres": {"id": null, "name": "TTF Supabase Postgres"}}
```

- **Supabase node** (`n8n-nodes-base.supabase`): resource `row`, operations `create`, `get`, `getAll`, `update`, `delete`; `tableId` is the table name, for example `team_07_places`. With more than one condition set `matchType` to `allFilters`: the default `anyFilter` joins the conditions with OR, also on update and delete. Get Many needs `returnAll: true` for more than the first page. Create with `dataToSend: "autoMapInputData"`: put `id` into `inputsToIgnore`. Create sends all incoming items in one request: for thousands of rows put "Loop Over Items" in front of it (batch size 200 to 500, with embeddings 50). Get, Get Many, Update and Delete run once per incoming item; after a node with several items set "Execute Once" on a Get Many.
- **HTTP Request to a function:** POST `https://supabase.ttf.buildbar.at/rest/v1/rpc/<function>`, `authentication: "predefinedCredentialType"`, `nodeCredentialType: "supabaseApi"`, credential "TTF Supabase" (it sets `apikey` and `Authorization`), JSON body with exactly the parameter names of the function. A wrong name gives HTTP 404 `PGRST202` "Could not find the function ... in the schema cache".
- **Postgres node** (`n8n-nodes-base.postgres`): operations `executeQuery`, `insert`, `upsert`, `select`, `update`, `deleteTable` (shown as "Delete"). In `executeQuery` pass values from a webhook as `$1`, `$2` through "Query Parameters" (`options.queryReplacement`), never inside the SQL text. `upsert` needs a unique column such as `source_id`.
- Tested end to end from the one.intelligence n8n on 7 November: webhook, Supabase node writes, Postgres node reads.

## In the app (supabase-js)

The app may use the shared Supabase directly with the public anon key, on tables with Row Level Security and a narrow policy (see `team_07_places_read` above). Writes with the service_role key never happen in the app: the app calls an n8n webhook and the workflow writes with "TTF Supabase".

```bash
npm --prefix frontend-starter install @supabase/supabase-js
```

```ts
// frontend-starter/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  return (client ??= createClient(url, key));
}
```

```ts
// in a client component, for example in an effect or a click handler
const { data, error } = await supabase().from("team_07_places").select("id, name, town").order("name");
if (error) throw new Error(error.message);
```

- **The anon key** is public by design: a team member may paste it into the chat or put it into `frontend-starter/.env.local` themselves. Take it from there.
- **Locally:** `frontend-starter/.env.local` with `NEXT_PUBLIC_SUPABASE_URL=https://supabase.ttf.buildbar.at` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>`.
- **Published app:** pass only `NEXT_PUBLIC_` values to `publish_app`, here `env` `{"NEXT_PUBLIC_SUPABASE_URL": "https://supabase.ttf.buildbar.at", "NEXT_PUBLIC_SUPABASE_ANON_KEY": "<anon>"}`. They are set at build time, end up in the browser and stay set for later publishes.
- Never write the anon key into the code or another committed file: the code reads it from `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- An insert policy for anon lets anyone on the internet write into the table. For writes without a login, use a webhook that checks the input.

## Test logins (Auth)

- Sign-up with e-mail and password is on, without a confirmation mail: after `supabase().auth.signUp({ email, password })` the account can sign in right away (`signInWithPassword`).
- `auth.users` is shared by all teams: test accounts only, no real people. An account works in the apps of all teams.
- Anyone with the anon key can sign up, so a policy `to authenticated using (true)` protects nothing. For rows per user:

```sql
create table if not exists public.team_07_favorites (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  place_id bigint not null,
  created_at timestamptz not null default now()
);
alter table public.team_07_favorites enable row level security;
drop policy if exists team_07_favorites_own on public.team_07_favorites;
create policy team_07_favorites_own on public.team_07_favorites
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
notify pgrst, 'reload schema';
```

A signed-in user of the app then reads and writes only their own rows with `supabase().from("team_07_favorites")`.

## Files (Storage)

- Buckets carry the slot id: `team-07-photos`. Creating and deleting buckets in the Studio (Storage) or through the API with the service_role key was checked on 7 November:

```bash
set -a; . ./.env.local; set +a
curl -sS "$SUPABASE_URL/storage/v1/bucket" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "team-07-photos", "public": true}'
```

- Upload from n8n: HTTP Request POST `https://supabase.ttf.buildbar.at/storage/v1/object/team-07-photos/<file name>` with credential "TTF Supabase" (as for functions) and the file as binary body. Files of a public bucket are at `https://supabase.ttf.buildbar.at/storage/v1/object/public/team-07-photos/<file name>`. Uploads were not part of that check: try one file first.
- A public bucket can be read by anyone who has the address: only files the team may publish.

## Vector search

Table and search function as in Supabase's LangChain quickstart (`https://supabase.com/docs/guides/ai/langchain`), with the prefix:

```sql
set search_path = public, extensions;

create table if not exists public.team_07_documents (
  id bigserial primary key,
  content text,
  metadata jsonb,
  embedding extensions.vector(1536)
);
alter table public.team_07_documents enable row level security;

create or replace function public.team_07_match_documents (
  query_embedding extensions.vector(1536),
  match_count int default null,
  filter jsonb default '{}'
) returns table (id bigint, content text, metadata jsonb, similarity float)
language plpgsql
set search_path = public, extensions
as $$
#variable_conflict use_column
begin
  return query
  select id, content, metadata, 1 - (team_07_documents.embedding <=> query_embedding) as similarity
  from public.team_07_documents
  where metadata @> filter
  order by team_07_documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

notify pgrst, 'reload schema';
```

- **n8n:** node "Supabase Vector Store" (`@n8n/n8n-nodes-langchain.vectorStoreSupabase`, typeVersion 1.3) with credential "TTF Supabase". "Table Name": `tableName` `{"__rl": true, "mode": "id", "value": "team_07_documents"}`. Under Options the query name: `queryName: "team_07_match_documents"`. Mode `insert` stores documents (with a document loader through `ai_document`), `load` ("Get Many") or `retrieve-as-tool` searches. The embeddings node attaches through `ai_embedding`.
- **Embedding model:** it needs a key. one.intelligence offered no embedding model on 6 November, so the team creates its own credential (for example OpenAI) named with the slot id, such as `team-07 OpenAI`. `vector(1536)` fits OpenAI `text-embedding-3-small`; another model needs its own dimension in the table and the function.

## Geodata

- A column `location extensions.geography(Point, 4326)`. Write a point as text `POINT(<lon> <lat>)`: longitude first, a space, no comma, for example `POINT(13.04 47.80)`. The REST API took exactly this text on 7 November (insert into a geography column, then read back); the Supabase node sends the same request. Check the first row anyway.
- Read coordinates and distances through a view or a function:

```sql
set search_path = public, extensions;

alter table public.team_07_places add column if not exists location extensions.geography(Point, 4326);

create or replace view public.team_07_places_geo with (security_invoker = true) as
select id, name, st_y(location::geometry) as lat, st_x(location::geometry) as lon
from public.team_07_places;

create or replace function public.team_07_places_near(p_lat float, p_lon float, p_radius_m float default 2000)
returns table (id bigint, name text, distance_m float)
language sql stable
set search_path = public, extensions
as $$
  select p.id, p.name, st_distance(p.location, st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography) as distance_m
  from public.team_07_places p
  where st_dwithin(p.location, st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography, p_radius_m)
  order by distance_m;
$$;

notify pgrst, 'reload schema';
```

Read the view like a table (Supabase node, `supabase-js`). Call the function from n8n with POST `/rest/v1/rpc/team_07_places_near` and the body `{"p_lat": 47.80, "p_lon": 13.04, "p_radius_m": 2000}`.

## Limits and pitfalls

- **Tables without Row Level Security are open.** Checked on 7 November: a new table in `public` without RLS can be read and written with the anon key, which every participant has. Every `create table` gets `enable row level security` at once.
- **Views and functions:** create views `with (security_invoker = true)`; a view without it runs with the rights of its owner and skips the RLS of its tables. No `security definer` on functions.
- **New table or function not found** by the REST API or the Supabase node: `notify pgrst, 'reload schema';` was missing. Run it.
- **Transaction mode (port 6543)** has no prepared statements: Prisma needs `?pgbouncer=true` there. Use port 5432 for psql and migrations.
- **Certificate:** the pooler uses a self-signed certificate. `sslmode=require` encrypts without checking it (psql, DBeaver). Node `pg` (node-postgres, also inside Drizzle or the pg adapter of Prisma) treats `require` as a full check and fails: use `?uselibpqcompat=true&sslmode=require` or `?sslmode=no-verify` in its URL. `ssl: { rejectUnauthorized: false }` works only with a URL without `sslmode`, because the values in the URL win.
- **Ownership:** "must be owner" from n8n or psql means the object was created through `/pg/query` (or probably the Studio) and belongs to `supabase_admin`. Change it the way it was created (see "Run the SQL").
- **Tables of other teams:** never change or delete them, and use your prefix in every name. A dropped table comes back only through a restore by the organisers.
- **Data:** prototype data only, no personal data, test accounts only. Licences and credits as in skill `data-catalog`.
- **Supabase CLI and MCP server:** `supabase link` and the official Supabase MCP server need a project at supabase.com. They are not needed here; use the ways in "Run the SQL".
- **After the event:** the table definitions stay in `supabase/*.sql`. Ask at the buildbar_ desk how long the shared Supabase and its data stay online. Its keys may change after the event: an app that reads it directly then needs the new anon key and a new build.
