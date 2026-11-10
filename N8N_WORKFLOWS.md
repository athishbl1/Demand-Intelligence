# n8n workflow reference

A blueprint of every n8n workflow in this project, written so that a person or a coding agent can rebuild the backend from this file and the code in the repo. The workflow JSON files in [`workflows/`](workflows/) are the source of truth. The node code is extracted next to them for easy reading.

## How to use this file with an agent

1. Create the credentials listed in [Credentials](#credentials) in your own n8n.
2. Run the SQL in [`supabase/`](supabase/) in order (`01_schema.sql`, `02_agent.sql`, `03_*`, `04_*`, `05_*`).
3. Either import the JSON files (n8n: *Import from File*) or rebuild node by node from the tables below, pasting the code from the extracted files.
4. Replace the webhook paths if you are not slot `team-07`. A path can only be active once per n8n instance.
5. Activate each workflow, then test it with the example calls at the end.

> **Known drift: `workflows/agent.json` is older than the live workflow.** The last commit to that file does not contain the alert-rule nodes (`Save rule`, `Check rules`, the hourly trigger and the `rules`, `rule_save`, `rule_delete`, `check` actions). The SQL for them exists (`workflows/agent-sql/check_rules.sql`, `rule_save.sql`) and `workflows/agent-sql/load_context.sql` is newer than the JSON. Before reusing this workflow, re-export it from n8n (or rebuild those nodes from the section [Alert rule extension](#alert-rule-extension)).

---

## Overview

| # | Workflow | Trigger | Nodes | Role |
|---|---|---|---|---|
| 1 | `team-07 · API overview` | `GET team-07-overview` | 3 | Read-only dashboard data |
| 2 | `team-07 · Drop Watch & Investigate` | `POST team-07-agent`, schedule 07:00 | 19 (saved) | Explain gaps, feedback, alerts |
| 3 | `team-07 · Campaign Strategist` | `POST team-07-strategy` | 20 | Suggest, vote on and choose campaigns |
| 4 | `team-07 · Demo` | manual | 4 | Push a simulated day to the UI feed |
| 5 | `team-07 · Demo feed` | `GET team-07-demo-actual`, `POST team-07-demo-push` | 6 | Hold and hand out the pending demo record |
| 6 | `team-07 · Enrich` | `POST team-07-enrich` | 5 | Superseded: load holidays and weather. Replaced by `scripts/migrate_to_supabase.py --enrich` |
| 7 | `team-07 · Reason tool` | `POST team-07-reason-tool` | 7 | Superseded early prototype: rule-based reasons from live APIs |

Workflows 2 and 3 are the core. They share one pattern.

### Shared pattern: one webhook, a Switch on `action`

```
Webhook ─► Validate (Code) ─► Route (Switch) ─┬─ 0 AI path: Load → Build → [Need AI?] → Agent → Finalize → [Save?] → Save → Answer ─┐
                                               ├─ 1 Save feedback (Postgres) ──────────────────────────────────────────────────────┤
                                               ├─ 2 … (Postgres) ──────────────────────────────────────────────────────────────────┼─► Respond
                                               ├─ 3 … (Postgres) ──────────────────────────────────────────────────────────────────┤
                                               ├─ 4 … (Postgres) ──────────────────────────────────────────────────────────────────┤
                                               └─ 5 invalid request ───────────────────────────────────────────────────────────────┘
```

- **Validate** normalises and checks the request, and sets `action`. Invalid requests get `action: "invalid"` and fall to the last Switch output.
- **Route** is a Switch in `expression` mode that maps `action` to an output index. Unknown actions go to the last output.
- **Need AI?** is an IF node. If the deterministic code decides no AI is needed (for example `no_change`), it skips the agent. This saves LLM calls.
- **Save?** is an IF node. Cached or read-only results skip the database write.
- All Postgres nodes use `executeQuery` with a fixed, parameter-free SQL string. The Code node passes data as **base64 JSON in `payload`**, which the SQL decodes. The model never writes SQL.

---

## Credentials

Create these in the n8n editor (Credentials, then Create). Never put secrets into workflow JSON or the repo. In the saved JSON every credential `id` is `null` and n8n finds it by name.

| Name in the JSON | Node credential type | Used by | What it is |
|---|---|---|---|
| `TTF Supabase Postgres` | `postgres` | all Postgres nodes | Direct Postgres connection to the Supabase database |
| `TTF one.intelligence` | `openAiApi` | both `OpenAI Chat Model` nodes | OpenAI-compatible endpoint with a key. Substitute any OpenAI-compatible chat provider |

For the LLM node set **`responsesApiEnabled: false`**. The endpoint used here offers only `/chat/completions`, and the Responses API fails with HTTP 405.

## Workflow settings used

- `executionOrder: "v1"` everywhere.
- `timezone: "Europe/Vienna"` on the agent and strategy workflows (matters for the 07:00 schedule).
- `saveDataSuccessExecution` and `saveDataErrorExecution` set to `"all"` on the agent and strategy workflows, so every execution can be inspected.

## Webhook node settings (all webhooks)

| Parameter | Value |
|---|---|
| `typeVersion` | 2 |
| `responseMode` | `responseNode` (the answer comes from a *Respond to Webhook* node) |
| `options.allowedOrigins` | `*` (CORS, so the browser app can call it) |

---

## 1. `team-07 · API overview`

`GET /webhook/team-07-overview`. One query returns everything the dashboard needs.

| Node | Type (version) | Key parameters |
|---|---|---|
| Webhook | `webhook` (2) | GET, path `team-07-overview`, `responseNode`, CORS `*` |
| Query overview | `postgres` (2.7) | `executeQuery`. A single SQL statement (about 8.8k characters) that builds one JSON object in a `result` column |
| Respond | `respondToWebhook` (1.4) | `respondWith: json`, body `={{ $json.result }}` |

Connections: `Webhook → Query overview → Respond`.

The JSON object returned by the SQL contains: daily rows, weekly rows, KPIs, data quality counts, beds per village, holidays by week and market, events by week, weather by week, the booking lead-time mix and the peer-region index. The SQL is inside `workflows/api-overview.json` (node `Query overview`).

---

## 2. `team-07 · Drop Watch & Investigate`

`POST /webhook/team-07-agent` plus a daily schedule. Explains a gap, stores versions, takes feedback, and manages alerts.

### Nodes

| Node | Type (version) | Key parameters | Code or SQL source |
|---|---|---|---|
| Webhook | `webhook` (2) | POST, path `team-07-agent`, `responseNode`, CORS `*` | |
| Every day 07:00 | `scheduleTrigger` (1.2) | interval days = 1, hour 7, minute 0 | |
| As-of report | `code` (2), run once for all items | Builds the daily `report` request for the scheduled run | inline in JSON |
| Validate | `code` (2), once per item | Normalises request, validates dates (range `2025-11-04` to `2027-04-04`), builds `scope_key`, base64 `payload`. Model name constant is `gpt-4.1-mini` | `workflows/agent-code/validate.js` |
| Route | `switch` (3.2), mode `expression`, 6 outputs | `={{ ({ explain: 0, report: 0, regenerate: 0, feedback: 1, get: 2, alerts: 3, alert_status: 4 })[$json.action] ?? 5 }}` | |
| Load context | `postgres` (2.7) | `executeQuery`, loads the period, previous versions, feedback, driver model and context in one query | `workflows/agent-sql/load_context.sql` |
| Build facts | `code` (2), once per item | Classifies the change type, builds the numbered fact pack, runs the driver attribution, prepares `system` and `prompt` and sets `need_ai`. The biggest node (about 41k characters) | `workflows/agent-code/build_facts.js`, `drivers_block.js` |
| Need AI? | `if` (2.2) | `={{ $json.need_ai }}` is true. True goes to AI Agent, false goes to Finalize | |
| AI Agent | `agent` (3.1) | `promptType: define`, text `={{ $json.prompt }}`, `systemMessage: ={{ $json.system }}`, `maxIterations: 3`, `hasOutputParser: false` | |
| OpenAI Chat Model | `lmChatOpenAi` (1.3) | model `gpt-4.1-mini`, `temperature 0.2`, `maxTokens 900`, `timeout 60000`, `responsesApiEnabled false` | |
| Finalize | `code` (2), once per item | Validates AI output, checks numbers against facts, drops invalid reasons, caps confidence, computes the unexplained share, builds `respond` and the `save` flag | `workflows/agent-code/finalize.js` |
| Save? | `if` (2.2) | `={{ $json.save }}` is true. True goes to Save explanation, false goes to Answer | |
| Save explanation | `postgres` (2.7) | `executeQuery`, inserts a new version row and an alert if the threshold is hit | `workflows/agent-sql/save.sql` |
| Answer | `code` (2), once per item | Merges the saved ids and version list into the response | `workflows/agent-code/answer.js` |
| Save feedback | `postgres` (2.7) | `executeQuery`, inserts votes, tags and notes | `workflows/agent-sql/feedback.sql` |
| Get explanation | `postgres` (2.7) | `executeQuery`, reads one explanation with versions | `workflows/agent-sql/get.sql` |
| List alerts | `postgres` (2.7) | `executeQuery`, alert inbox and unread count | `workflows/agent-sql/alerts.sql` |
| Set alert status | `postgres` (2.7) | `executeQuery`, sets `read` or `dismissed` | `workflows/agent-sql/alert_status.sql` |
| Respond | `respondToWebhook` (1.4) | `respondWith: json`, body `={{ JSON.stringify($json.result ?? $json) }}`, CORS headers in options | |

### Connections

```
Webhook ──────────────► Validate
Every day 07:00 ─► As-of report ─► Validate
Validate ─► Route
Route[0] ─► Load context ─► Build facts ─► Need AI?
Need AI?[true]  ─► AI Agent ─► Finalize
Need AI?[false] ─────────────► Finalize
Finalize ─► Save?
Save?[true]  ─► Save explanation ─► Answer
Save?[false] ──────────────────────► Answer
Answer ─► Respond
Route[1] ─► Save feedback    ─► Respond
Route[2] ─► Get explanation  ─► Respond
Route[3] ─► List alerts      ─► Respond
Route[4] ─► Set alert status ─► Respond
Route[5] ─► Respond                       (invalid request)
OpenAI Chat Model ══ ai_languageModel ══► AI Agent
```

### Actions (request bodies)

| `action` | Body fields | Result |
|---|---|---|
| `explain` | `scope: day \| week \| range`, `date` or `week` (`2026-W16`) or `from` and `to`, `compare: py \| fc`, `force` | Explanation with at most 3 reasons, driver breakdown, unexplained share, versions |
| `report` | `date`, `actual`, optional `forecast` | Same as explain for one day, may raise an alert (also used by the 07:00 schedule) |
| `regenerate` | `explanation_id`, optional `note` | New version using feedback. At most 5 versions |
| `feedback` | `explanation_id`, `version`, `feedback[]` of `{reason_idx, vote, tags, text, ignore}` | Saved feedback. Text is at most 500 characters |
| `get` | `explanation_id` | One explanation with its versions |
| `alerts` | optional `status: unread \| read \| dismissed \| open` | Alert list and unread count |
| `alert_status` | `id`, `status` | Updated alert |

### Alert rule extension

The live workflow also has these actions. They are not in the saved JSON (see the drift note at the top):

| `action` | Node and source | Purpose |
|---|---|---|
| `rules` | list rules | Return the saved alert rules |
| `rule_save` | `Save rule`, `workflows/agent-sql/rule_save.sql` | Create or update a rule |
| `rule_delete` | delete a rule | Remove a rule |
| `check` | `Check rules`, `workflows/agent-sql/check_rules.sql` | Evaluate the three rule types from today forward |

Extra trigger: a schedule `Every hour: check rules` at minute 5, which feeds the `check` action.

The three rule types (SQL in `check_rules.sql`, tables in `supabase/05_three_alert_types.sql`):

1. A coming week looks weak: forecast versus last year, default threshold 8 %. The alert names the source markets on school holiday that week.
2. Bookings slowing down: the latest week against the 4-week average, only with at least 100 bookings.
3. Forecast missing: days without a forecast in the next 56 days.

Every alert gets an **act-by date** = week start − 31 days (the median booking lead time from `team_07_lead_time`).

---

## 3. `team-07 · Campaign Strategist`

`POST /webhook/team-07-strategy`. Builds on a saved explanation from workflow 2.

### Nodes

| Node | Type (version) | Key parameters | Code or SQL source |
|---|---|---|---|
| Webhook | `webhook` (2) | POST, path `team-07-strategy`, `responseNode`, CORS `*` | |
| Validate | `code` (2), once per item | Checks `action` and ids, builds the payload | `workflows/strategy-code/validate.js` |
| Route | `switch` (3.2), mode `expression`, 6 outputs | `={{ ({ strategize: 0, regenerate: 0, custom: 0, feedback: 1, decide: 2, get: 3, list: 4 })[$json.action] ?? 5 }}` | |
| Load set | `postgres` (2.7) | `executeQuery`, reads the explanation, reasons, facts, earlier versions and feedback | `workflows/strategy-sql/load_set.sql` |
| Plan target | `code` (2), once per item | **No AI.** Picks the mode (`recover`, `capitalise`, `monitor`, `none`) and the future target window. A past period maps to the same period next season, Easter-aligned if Easter explains the gap | `workflows/strategy-code/plan_target.js` |
| Load forward | `postgres` (2.7) | `executeQuery`, weeks ±2 around the target, school holidays per market, events, lead-time mix, beds per village | `workflows/strategy-sql/load_forward.sql` |
| Build candidates | `code` (2), once per item | Facts `s.*` and `r*`, room to fill, launch-by date from lead time, rule-based playbook candidates, prompt text and `need_ai` (about 16k characters) | `workflows/strategy-code/build_candidates.js` |
| Need AI? | `if` (2.2) | `={{ $json.need_ai }}` is true. True goes to Strategist Agent, false goes to Finalize | |
| Strategist Agent | `agent` (3.1) | `promptType: define`, text `={{ $json.prompt }}`, `systemMessage: ={{ $json.system }}`, `maxIterations: 3` | |
| OpenAI Chat Model | `lmChatOpenAi` (1.3) | model `gpt-4.1-mini`, low temperature, `responsesApiEnabled false` | |
| Finalize | `code` (2), once per item | Guardrails: at most 3 strategies, evidence citation, fixed lists for markets, channels and KPIs, forced computed dates, strips sentences with unverified numbers or percentages, confidence caps | `workflows/strategy-code/finalize.js` |
| Save? | `if` (2.2) | `={{ $json.save }}` is true | |
| Save set | `postgres` (2.7) | `executeQuery`, inserts a new strategy set version | `workflows/strategy-sql/save.sql` |
| Answer | `code` (2), once per item | Merges ids and versions into the response | `workflows/strategy-code/answer.js` |
| Save feedback | `postgres` (2.7) | `executeQuery`, votes and corrections | `workflows/strategy-sql/feedback.sql` |
| Decide | `postgres` (2.7) | `executeQuery`, records the choice | `workflows/strategy-sql/decide.sql` |
| Get set | `postgres` (2.7) | `executeQuery`, reads one set | `workflows/strategy-sql/get.sql` |
| List sets | `postgres` (2.7) | `executeQuery`, lists sets | `workflows/strategy-sql/list.sql` |
| Respond | `respondToWebhook` (1.4) | `respondWith: json`, body `={{ JSON.stringify($json.result ?? $json) }}` | |
| Note | `stickyNote` (1) | Documentation of the flow on the canvas | |

### Connections

```
Webhook ─► Validate ─► Route
Route[0] ─► Load set ─► Plan target ─► Load forward ─► Build candidates ─► Need AI?
Need AI?[true]  ─► Strategist Agent ─► Finalize
Need AI?[false] ───────────────────► Finalize
Finalize ─► Save?
Save?[true]  ─► Save set ─► Answer
Save?[false] ────────────► Answer
Answer ─► Respond
Route[1] ─► Save feedback ─► Respond
Route[2] ─► Decide        ─► Respond
Route[3] ─► Get set       ─► Respond
Route[4] ─► List sets     ─► Respond
Route[5] ─► Respond                      (invalid request)
OpenAI Chat Model ══ ai_languageModel ══► Strategist Agent
```

### Actions

| `action` | Body fields | Result |
|---|---|---|
| `strategize` | explanation reference (`explanation_id`) | Up to 3 ranked strategies with target window and launch-by date |
| `regenerate` | `set_id`, optional `note` | New version using feedback (up to 5) |
| `custom` | `explanation_id`, free-text idea | The user's idea, structured and fact-checked as option 4 |
| `feedback` | `set_id`, votes, corrections | Saved feedback |
| `decide` | `set_id`, `choice`: `0`, `1`, `2` (strategy), `3` (own idea), `dismiss` or `reopen` | Status and accepted index |
| `get` | `set_id` | One set with versions |
| `list` | optional filters | All sets |

---

## 4. `team-07 · Demo` and 5. `team-07 · Demo feed`

A small pair that lets a presenter push a simulated "actual" figure into the live UI.

**Demo** (manual trigger)

| Node | Type | Parameters |
|---|---|---|
| Execute workflow | `manualTrigger` (1) | none |
| Demo day forecast | `postgres` (2.7) | `executeQuery`, picks a demo day and its forecast (about 260 characters of SQL) |
| Build demo record | `code` (2), once for all items | Creates a record with a dummy count. Source `workflows/demo-code/build_demo_record.js` |
| Push to UI feed | `httpRequest` (4.2) | POST `https://n8n.oi.destination.one/webhook/team-07-demo-push`, JSON body `={{ JSON.stringify($json.record) }}` |

Connections: `Execute workflow → Demo day forecast → Build demo record → Push to UI feed`.

**Demo feed** (two webhook branches in one workflow)

| Node | Type | Parameters |
|---|---|---|
| Receive dummy count (POST) | `webhook` (2) | POST `team-07-demo-push`, `responseNode` |
| Store pending | `code` (2) | Stores the record in workflow static data. Source in the JSON |
| Respond push | `respondToWebhook` (1.4) | JSON of the record |
| Feed: read (GET) | `webhook` (2) | GET `team-07-demo-actual`, `responseNode`, CORS `*` |
| Take pending | `code` (2) | Returns the pending record and clears it. Source `workflows/demo-code/take_pending.js` |
| Respond feed | `respondToWebhook` (1.4) | JSON of the record |

Connections: `Receive dummy count → Store pending → Respond push`, and `Feed: read → Take pending → Respond feed`. The app polls the GET path, and the Demo workflow fills it.

---

## 6. `team-07 · Enrich` (superseded)

`POST team-07-enrich`. Loaded holidays and weather into Supabase. Replaced by `python3 scripts/migrate_to_supabase.py --enrich`. Keep it only for reference.

`Webhook → Build SQL (Code, builds INSERT statements for both tables and a counts object) → Write holidays (Postgres) → Write weather (Postgres) → Respond (body = counts from Build SQL)`.

---

## 7. `team-07 · Reason tool` (superseded prototype)

`POST team-07-reason-tool` with `{"date":"YYYY-MM-DD","location":"Ischgl","difference":-1200}`. Rule-based reasons from live open APIs, without AI. Replaced by the driver model.

| Node | Type | Parameters |
|---|---|---|
| Webhook | `webhook` (2) | POST `team-07-reason-tool` |
| Prepare | `code` (2) | Computes `from`, `to`, `date` |
| School holidays | `httpRequest` (4.2) | GET `https://openholidaysapi.org/SchoolHolidays`, query `countryIsoCode=AT`, `subdivisionCode=AT-TI`, `languageIsoCode=DE`, `validFrom`, `validTo` |
| Public holidays | `httpRequest` (4.2) | GET `https://openholidaysapi.org/PublicHolidays`, same query |
| Weather | `httpRequest` (4.2) | GET `https://api.open-meteo.com/v1/forecast`, latitude `46.97`, longitude `10.29`, daily `temperature_2m_max,precipitation_sum,snowfall_sum`, timezone `Europe/Vienna` |
| Reason | `code` (2) | Scores candidate reasons, returns the top three and a list of data gaps |
| Respond | `respondToWebhook` (1.1) | JSON of the result |

Connections: a straight chain `Webhook → Prepare → School holidays → Public holidays → Weather → Reason → Respond`.

---

## Replication checklist

1. Credentials: `TTF Supabase Postgres` (Postgres) and `TTF one.intelligence` (OpenAI-compatible).
2. Database: apply `supabase/01_schema.sql` to `05_three_alert_types.sql`, then run `scripts/migrate_to_supabase.py --enrich` and `scripts/fit_driver_model.py` so the driver model table is filled.
3. Create workflows 1, 2 and 3 (4 to 7 are optional). Order matters: workflow 3 reads what workflow 2 saves.
4. In every Code node paste the matching file from `workflows/*-code/`. In every Postgres node paste the matching file from `workflows/*-sql/`.
5. Re-add the alert-rule nodes to workflow 2 (see the drift note).
6. Activate. In n8n 2.x, changes to an active workflow go live only after you publish again.
7. Test with the calls below, then point the frontend at your n8n with `NEXT_PUBLIC_N8N_WEBHOOK_BASE`.

## Test calls

```bash
BASE=https://<your-n8n>/webhook

# Dashboard data
curl "$BASE/team-07-overview"

# Explain a week (Easter moved out of 2026-W16, expect a calendar driver first)
curl -X POST "$BASE/team-07-agent" -H 'Content-Type: application/json' \
  -d '{"action":"explain","scope":"week","week":"2026-W16"}'

# Suggest campaigns for a saved explanation
curl -X POST "$BASE/team-07-strategy" -H 'Content-Type: application/json' \
  -d '{"action":"strategize","explanation_id":"<id from the explain answer>"}'

# Strategy list
curl -X POST "$BASE/team-07-strategy" -H 'Content-Type: application/json' -d '{"action":"list"}'
```

Check the content of the answer, not only the HTTP status: right change type, at most three reasons, drivers plus unexplained summing to the gap, and a launch-by date in the future.

## Conventions learned while building

- Webhook payload sits under `$json.body`.
- Expressions in workflow JSON start with `=`, otherwise they are treated as literal text.
- IF nodes need `branch` (true or false) on each connection. Switch nodes need a `case` per connection.
- AI model connections use `sourceOutput: "ai_languageModel"`, not `sourcePort`.
- A node that returns 0 items silently ends the chain. The Postgres query nodes always return a row (a JSON `result` column) for that reason.
- Do the maths in SQL or Code. Let the LLM only write words, and verify every number it writes.
