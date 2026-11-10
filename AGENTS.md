# TTF Hackathon 2026: your team's app with n8n

This file tells you, the coding agent (Claude Code, Codex or OpenCode), how to work in this repository. Claude Code reads it through `CLAUDE.md`. The values of this team's slot are in `team.md`. The rules in this file come before every skill and every example.

**Setting:** the TTF Hackathon at the Tourism Technology Festival, Messezentrum Salzburg, Hall 10, from Saturday 7 November 2026, 13:00 to Sunday 8 November, 13:00 (all times CET, UTC+1). Teams of 3 to 6 people pick one of six challenges from the event partners and build a working prototype. The teams are technical and free in their use case. They use their own accounts (Claude or ChatGPT, GitHub). Several members may work in this repository at the same time, each with their own agent. This setup is a voluntary offer by buildbar_ (Friedemann Schütz), who helps on site.

**The stack:** an n8n workflow as the backend (data, AI, logic) and a Next.js app in `frontend-starter/` as the frontend, published at the team's own address.

| What | Where |
|---|---|
| n8n | the account of your challenge on `https://n8n.oi.destination.one` (one.intelligence by destination.one), shared with the other teams on the same challenge; `team_info` names challenge and project |
| Connection (MCP server `buildbar`) | `.mcp.json`, `.codex/config.toml`, `opencode.json`: `https://hub.ttf.buildbar.at/g/<token>/mcp` |
| Challenges | feed `https://buildbar.at/ttf-2026/claude.md` (skill `ttf-challenges`) |
| Data | TTF Data Space `https://portal.ttf.nexyo.io/`, open data, prepared credentials (skill `data-catalog`) |
| Database | the shared Supabase of the event `https://supabase.ttf.buildbar.at`, ready in n8n; keys for people in the access area `https://buildbar.at/ttf-2026#access`, behind the event code given on site (skill `supabase`) |
| Event page | `https://buildbar.at/ttf-2026` |
| The app | `https://<slug>.ttf.buildbar.at`, the address comes from `publish_app` |

The connection URL works like a password. Never copy it into another file, an answer, the app or a workflow.

## First contact

On the first message of a session, do this on your own, without commenting on each step:

1. **Read `team.md`** (slot id and repository). If it is missing or still shows placeholders (words in double underscores), tell the team that this repository is not set up yet and ask them to see the buildbar_ desk. Do nothing in n8n.
2. **Check the connection:** call `team_info` (slot, team name, slug, app address, members, challenge, n8n project, AI model endpoint) and `n8n_health_check`. If the slot from `team_info` differs from `team.md`, stop and ask the team to see the buildbar_ desk. If the `buildbar` tools are missing or the check fails, follow "Connection problems" below. Do not work around it, for example with direct calls to the n8n API.
3. **Existing work:** if `PLAN.md` exists, read it, list the workflows with `n8n_list_workflows` and continue where the team is. Say in two sentences what is there and what comes next.
4. **New team:** load the challenge feed (skill `ttf-challenges`), greet the team by its name from `team_info` (without a name if the slot has no team yet), confirm that n8n is connected. If `team_info` names the team's challenge, summarize that one from the feed (title, partners, core question, data); otherwise show the six challenges as a short numbered list. If the feed has no challenge texts, say so and offer what can be prepared meanwhile (skill `ttf-challenges`).
5. **Plan:** help the team find its idea for its challenge (or choose a challenge, if `team_info` names none), then write a short build plan in stages with a test for each stage (skill `idea-to-plan`). Build only after the team agrees to the plan.

## Working as a team

- **Git:** several people push to the same `main`. Before every push: `git fetch origin main`, then `git rebase origin/main`, then `git push origin HEAD:main`. Never force push. Resolve conflicts together with the team, do not throw away other people's work.
- **n8n:** two agents changing the same workflow at the same time overwrite each other, because the last save wins. Give each workflow one owner at a time, or split the work into separate workflows (sub-workflows called with "Execute Workflow").
- **Editor and agent:** after an agent changed a workflow, reload the n8n editor before editing there. Saving an old editor tab overwrites the agent's change.
- **`PLAN.md`** is the shared plan of the team. Mark stages as done and add what was learned, so every member and every new session can pick up.

## Time plan

| When (CET) | What |
|---|---|
| Sat 12:00 | challenges presented on stage, teams form |
| Sat 13:00 | start; until 15:00 brainstorming and partner workshops |
| Sat 16:00 | final challenge decision: exactly one challenge per team, team name on the Challenge Board |
| Sat afternoon | stage 1 runs end to end with real data |
| Sat evening | first published version of the app |
| Sun 09:00 to 12:00 | the technical jury visits the teams and looks at the project in detail |
| Sun 13:00 | submission (follow the organisers' instructions) |
| Sun 14:00 | pitches: 2 minutes per team |

- **News and changes** from the organisers come on the event Discord (link on the event page). Remind the team to have at least one person there.

- **Keep a working version at all times.** Publish after every stage that works, not only at the end. A small app that runs beats a big one that does not.
- If a stage takes much longer than planned, propose a smaller cut on your own.
- Check the time with `date` when it matters. In cloud sessions the clock is in UTC: 12:00 CET is 11:00 UTC.

## n8n: rules

1. **The shared n8n account of your challenge.** The connection works with the n8n account of the team's challenge, which `team_info` names (`challenge`, `n8n_project`). All teams on the same challenge share this account and see each other's workflows. Start every workflow name and every Data Table name with the slot id from `team.md` (for example `team-07 · Lake weather`). Change, activate or deactivate only workflows whose name starts with your slot id, and leave everything else alone, even when `n8n_list_workflows` shows it. The connection enforces this: it refuses to change, activate, test or roll back workflows and to write to Data Tables whose name does not start with your slot id, and it refuses new workflows, Data Tables, folders and template copies without it. An answer that starts with "Not allowed:" gives the reason: tell the team in one sentence, follow the hint in the message and do not look for a way around it, also not through a workflow or the editor. An answer that starts with "Not checked:" means the check could not be completed (n8n did not answer or answered with an error). Nothing was changed. Try once more after a minute; if it fails again, the team asks at the buildbar_ desk. Nodes count too: a "Data Table" node in your workflows uses only tables of your team, picked from the list or by id (no expression); to use another team's data or workflow, call its webhook. If `team_info` names no challenge, the team asks at the buildbar_ desk before you build. After the desk has set or changed the challenge, the team starts a new session before anything is built in n8n: an open session keeps working with the n8n account it started with.
2. **Credentials only in n8n.** Never put keys, passwords or tokens into code, workflow JSON, the repository, the app or the chat. If the team needs its own access (Data Space, own API keys), a team member creates the credential in the n8n editor (Credentials, then Create) and names it with the slot id, for example `team-07 Data Space`. Ask the team never to paste a key into the chat. Two exceptions, both for the shared Supabase (skill `supabase`): its anon key is public by design, may pass through the chat and goes into the app only as `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`frontend-starter/.env.local` locally, the `env` of `publish_app` when publishing), never into a committed file. And for SQL from your own session a team member may hand you its service_role key or Postgres connection once, typed into `.env.local` in the repository root or pasted once into the chat: keep it only in that file (never in `frontend-starter/`) and never print it. The connection cannot list, create or change credentials. All teams on the challenge can see and use the credentials in this account: the team adds only keys it can revoke after the hackathon.
3. **Prepared and shared:** "TTF DataForSEO" and "TTF Apify", "TTF Supabase" and "TTF Supabase Postgres" (the shared Supabase, skill `supabase`), and the AI models of one.intelligence (endpoint and credential name in `team_info` under `llm`). Details, how to reference them and what they cost: skill `data-catalog`. DataForSEO and Apify cost money per call: test with one item before running many. All teams share 100,000 OI Calls, the currency of one.intelligence: every model answer uses them.
4. **Webhook paths are unique in the whole n8n instance**, across all teams. Start every webhook and form path with the slot id from `team.md`, for example `team-07-search`.
5. **Save every workflow as JSON in `workflows/`** after each stage: fetch it with `n8n_get_workflow` in the default mode `full` (`structure` and `minimal` leave parts out). From the workflow object (under `data` in the result) keep only `name`, `nodes`, `connections` and `settings`. Everything else goes: `shared` (it holds the email address of the n8n account), `pinData`, `meta`, `staticData`, `tags`, `active`, the workflow `id`, versions and timestamps. Keep the nodes as they are (node ids, `webhookId`, parameters, positions) with one change: in every credential reference set `id` to `null` and keep the type key and the `name`, for example `"credentials": {"httpBasicAuth": {"id": null, "name": "TTF DataForSEO"}}`. Do not delete the `id` key: n8n looks a credential up by name only when its `id` is `null`, and that lets `n8n_create_workflow` create the workflow from this file again. Save it as `workflows/<short-name>.json`, commit and push.
6. **Publish after changes.** In n8n 2.x a change to an active workflow goes live only after publishing again: `n8n_update_partial_workflow` with `{"type": "activateWorkflow"}`. Until then the webhook runs the old version. To remove the trigger of an active workflow (for example a temporary test webhook), deactivate it first and remove the node in a second call: in one call n8n refuses with "Workflow cannot be activated because it has no trigger node" and rolls everything back, and the webhook stays open.
7. **Sub-workflows must be active (published).** Otherwise "Execute Workflow" fails with "Workflow is not active".
8. **Not available through the connection:** deleting workflows, `n8n_update_full_workflow`, credentials, `n8n_audit_instance`, agents, deleting folders, versions, executions, Data Table rows or tables, renaming or moving folders, renaming Data Tables and moving workflows to another project. To retire a workflow, deactivate it and put "OLD" right after the slot id, for example `team-07 · OLD Lake weather`. A team member can delete things in the n8n editor if needed.
9. **Data:** respect the license and terms of every source, show the source in the app, no personal data of real guests. Details in skill `data-catalog`. Small data goes into Data Tables; for larger data, SQL, vector search, geodata, test logins or files use the shared Supabase of the event (skill `supabase`). It is one database for all teams: every table, view, function and policy starts with the slot id in underscore form (`team_07_places`), and every table gets Row Level Security.

## How you build

1. **Nodes:** `search_nodes`, then `get_node` with `detail: "standard"`, with `includeExamples: true` when useful. Do not use `detail: "full"`.
2. **Create and extend:** `n8n_create_workflow`, then step by step `n8n_update_partial_workflow` with `intent`, several operations in one call.
3. **Validate:** `n8n_validate_workflow` with profile `runtime`, then `n8n_autofix_workflow`.
4. **Test** as below, then save the workflow (rule 5).

Prefer native nodes; use a Code node only when no node fits. Set every parameter that controls a node's behaviour explicitly, defaults are the most common cause of runtime errors. Work on your own and do not ask for permission for every step; afterwards say briefly what you built and tested.

## Testing

- **Every stage has a test:** a real example and the expected result, agreed in `PLAN.md` before building.
- **Webhook workflows:** activate the workflow, then `n8n_test_workflow` with `workflowId` and the request body as `data`. In the workflow the body is under `$json.body`.
- **Schedule, manual and chat triggers** cannot be started through the connection. Add a temporary webhook with a slot path in front of the first step, or ask a team member to click "Execute workflow" in the editor, then read the execution.
- **A green run is no proof.** Fetch the execution (`n8n_executions` with `action: "get"`) and check the content: right numbers, right texts, as many items as expected.
- **Silent stops:** a node that returns 0 items ends the chain without an error. Switch on "Always Output Data" and check with an IF node. Language models invent numbers when they have to calculate: let n8n do the maths.
- **No tight polling loops.** `n8n_test_workflow` waits for the result. Do not poll executions every few seconds.

## n8n conventions (critical)

- **nodeType format:** search and validation tools take `nodes-base.slack`, workflow tools take `n8n-nodes-base.slack`, AI nodes are `@n8n/n8n-nodes-langchain.agent`.
- **Webhook data is under `.body`:** `{{ $json.body.name }}`, not `{{ $json.name }}`.
- **Expressions** use `{{ }}`. In Code nodes write plain JavaScript without `{{ }}`. Node names with spaces go in quotes: `{{ $('HTTP Request').item.json.data }}`. Names are case sensitive.
- **Expressions in workflow JSON start with `=`:** `"text": "=Summary of {{ $json.body.title }}"`. Without the `=` the text goes through literally, also in the prompt of an AI node, and validation does not complain. Only one `=` at the start, even with several `{{ }}` in the field.
- **IF node:** two outputs, so set `branch: "true"` or `branch: "false"` on `addConnection`. Without `branch` both connections land on the same output.
- **Switch node:** every connection needs `case` in the order of the rules (`case: 0`, `case: 1`, ...), otherwise all of them land on output 0.
- **Set node (typeVersion 3.4):** fields go into `assignments`: `{"mode": "manual", "includeOtherFields": false, "assignments": {"assignments": [{"id": "f1", "name": "city", "value": "={{ $json.body.city }}", "type": "string"}]}, "options": {}}`. The old format `fields.values` with `stringValue` passes validation, but the node silently returns `{}`.
- **addConnection** takes four strings: `{"type": "addConnection", "source": "Webhook", "target": "Respond", "sourcePort": "main", "targetPort": "main"}`. An object (`connection: {...}`) or a combined string like `"Webhook:main:0"` fails. `removeConnection` works the same way.
- **one.intelligence models:** in the node "OpenAI Chat Model" set `responsesApiEnabled: false` ("Use Responses API" off). one.intelligence offers only `/chat/completions`; with the Responses API the call fails with "405 Method Not Allowed". Details in skill `data-catalog`.
- **AI connections** use `sourceOutput`, not `sourcePort`: `{"type": "addConnection", "source": "OpenAI Chat Model", "target": "AI Agent", "sourceOutput": "ai_languageModel"}`. The same goes for `ai_tool`, `ai_memory`, `ai_outputParser`, `ai_embedding`, `ai_vectorStore`, `ai_document`, `ai_textSplitter`. With `sourcePort` the model ends up on a normal output and the run fails.
- **AI answers as JSON:** on a "Basic LLM Chain" set `hasOutputParser: true` and attach a "Structured Output Parser" with an example JSON via `sourceOutput: "ai_outputParser"`. Without a parser, strip code fences before parsing: `JSON.parse(String($json.text).replace(/```(json)?/g, '').trim())`.
- **Earlier steps:** `$json` only holds the data of the direct predecessor. Fields of earlier steps: `{{ $('Step name').item.json.field }}`, in Code nodes `$('Step name').all()`.
- **No loop needed:** n8n runs every node once per item. "Loop Over Items" is only for throttling slow or rate limited services.

## The app

- The app lives in `frontend-starter/` (Next.js 16.4.5, React 19, TypeScript, Tailwind 4). Skills `frontend-build` (look, building blocks, connection) and `frontend-scaffold` (new pages). One app per team: add pages, do not create a second app.
- Name, tagline, accent colour, logo and language: `frontend-starter/lib/app.ts`.
- The app calls the team's webhooks with `callWebhook()` from `lib/n8n.ts`. The base address comes from `NEXT_PUBLIC_N8N_WEBHOOK_BASE`, default `https://n8n.oi.destination.one/webhook`. In the Webhook node set the option "Allowed Origins (CORS)" to `*` and answer with "Respond to Webhook".
- **No secrets in the app.** Everything in the browser, including every `NEXT_PUBLIC_` value, is public. Keys stay in n8n credentials, and the workflow calls the services. The one key allowed in the app is the public anon key of the shared Supabase, read from `NEXT_PUBLIC_SUPABASE_ANON_KEY` and never written into a committed file, for tables with Row Level Security and a narrow policy (skill `supabase`).
- **Build** from the repository root, without `cd`: `npm --prefix frontend-starter install`, then `npm --prefix frontend-starter run build`. It must be green before every publish.

## Publishing

Details in skill `publish`.

1. Build green (see above).
2. Commit, then `git fetch origin main`, `git rebase origin/main`, `git push origin HEAD:main`, one command at a time and without `cd` or `git -C`. Only `main` is built. Never force push.
3. Call `publish_app`. The folder defaults to `frontend-starter`. Pass `env` only for extra `NEXT_PUBLIC_` values, never secrets. If `n8n_url` from `team_info` is not `https://n8n.oi.destination.one`, pass `{"NEXT_PUBLIC_N8N_WEBHOOK_BASE": "<n8n_url>/webhook"}`.
4. Call `publish_status`. It waits up to 45 seconds by itself. If the build is still running, call it again, but not more often than every 30 seconds. The first build takes a few minutes; until then the address shows an error. Right after the first publish the HTTPS certificate can need up to a minute: until then the server shows a self-signed placeholder certificate ("TRAEFIK DEFAULT CERT") that browsers and `curl` refuse. Tell the team to wait a minute and reload instead of accepting the warning. If it is still there after three minutes, do not publish again because of it; the team asks at the buildbar_ desk. Give the address from the result to the team.
5. Later changes: commit, push, `publish_app` again. The address stays the same.

A network error during the build ("Could not resolve hostname", "Try again", a failed clone) is not caused by the code: publish again without changes. For a build error, read the error lines, fix the cause, build locally, push and publish again. If the tools report a missing deploy key or keep failing, the team asks at the buildbar_ desk.

## Pitch

When the team asks, and on Sunday from 12:00 on your own, offer a short pitch outline in `PITCH.md`: the challenge and who has the problem, the idea in one sentence, the demo path in three steps (with the app address), the data and how it works (n8n plus app), what comes next. Keep it short and in the team's words. The pitch has **2 minutes**: about 250 spoken words, one live demo path. The jury rates presentation, creativity and impact (65 percent), the challenge partner ranks the teams of its challenge (35 percent), so name the partner's question and show the answer to it. Before that, a technical jury visits the team on Sunday between 09:00 and 12:00: keep the app address and a short walk-through ready.

## Connection problems

| Situation | What to do |
|---|---|
| Claude Code in the browser: `buildbar` tools missing or `n8n_health_check` cannot connect | The cloud environment blocks the hub. On the screen for a new session, open the environment selector under the message box, open the settings icon of the environment, set "Network access" to "Full" and select "Save changes" (in a running session: the caret after the session title, then "Edit cloud environment"). Then start a new session from the team page. |
| Claude Code on the desktop, in VS Code or VSCodium, or in the terminal | Trust the folder when asked. In VS Code or VSCodium, first reload the window ("Developer: Reload Window") and start a new conversation: the extension often keeps its server list from before the clone. Run `/mcp`: `buildbar` must show as connected; approve it if it waits for approval. If it is missing, add it in the `/mcp` dialog (HTTP, URL from `.mcp.json`) or with `claude mcp add --transport http buildbar <url from .mcp.json>`, then start a new conversation. |
| Codex (CLI, IDE extension, app) | Codex reads `.codex/config.toml` only in trusted projects: trust the project when Codex asks. If the tools are still missing, add the server once for your user: `codex mcp add buildbar --url <url from .codex/config.toml>`, then restart Codex. `codex mcp list` shows it. |
| OpenCode | `opencode.json` in the repository root is read at start. Start OpenCode in the repository folder. |
| Tools present, but `n8n_health_check` fails or answers with an error about the instance | The slot or n8n may not be ready. Try once more after a minute, then the team asks at the buildbar_ desk. |
| "Session limit reached", HTTP 429 or a timeout | Wait a minute. If the call that timed out creates, changes or runs something, first check whether it went through (next row), then try again. Do not retry in a loop. |
| A `buildbar` tool fails with a connection error such as "Error dialing" | Usually a short network hiccup. Before you repeat a call that creates, changes or runs something, check whether it went through, so nothing happens twice: `n8n_list_workflows` or `n8n_get_workflow` after creating or changing a workflow, `n8n_executions` with `action: "list"` after `n8n_test_workflow` (a second test run calls paid services again), `publish_status` after `publish_app`. Then try once more. If it fails again, wait a minute; if it keeps failing, the team asks at the buildbar_ desk. |
| `git commit` stops with "Author identity unknown" | This computer has no commit identity. Ask the person at this computer for the name and email address to use (their GitHub noreply address, under GitHub Settings, Emails, keeps their own address private) and set them for this repository only, without `--global` even though git suggests it: `git config user.name "<name>"`, `git config user.email "<email>"`. Never make them up and never copy them from `git log` (its first commits are by the organisers), from a team member or from another account. Then commit again. |
| `git push` rejected with "GH007: Your push would publish a private email address" | The commits carry an email address the person keeps private on GitHub. Ask for their GitHub noreply address (GitHub Settings, Emails), set it with `git config user.email "<noreply address>"`, rewrite the commits that are not on `origin/main` yet with `git rebase origin/main --exec "git commit --amend --no-edit --reset-author"` and push again. Never force, and do not suggest making the address public or switching the protection off. |
| Push to `main` rejected | `git fetch origin main`, `git rebase origin/main`, push again. Never force. |

## How you talk with the team

- Answer in the language the team writes in; English is the default.
- The teams are technical: technical terms are fine. Be short and concrete.
- When you need decisions, ask one question at a time and give your recommendation, so the team can just say yes.
- Call tools without commenting on each one. Afterwards say in two or three sentences what happened.
- Say honestly what did not work. Do not claim that something runs before you have tested it.

## Skills

The skills live in `.claude/skills/<name>/SKILL.md`. Claude Code and OpenCode load them as skills. In Codex, read the `SKILL.md` at that path as soon as the task matches.

- **Event:** `ttf-challenges` (feed, choosing a challenge), `idea-to-plan` (idea, stages, tests, `PLAN.md`), `grill-me` (check the plan with 3 to 5 questions), `data-catalog` (Data Space, open data, prepared credentials, Data Tables), `supabase` (shared database of the event: SQL, vector search, geodata, logins, files), `publish` (publishing the app).
- **Building with n8n** (by Romuald Członkowski): `n8n-mcp-tools-expert`, `n8n-workflow-patterns`, `n8n-node-configuration`, `n8n-expression-syntax`, `n8n-validation-expert`, `n8n-code-javascript`, `n8n-code-python`.
- **Quality:** `n8n-testing`, `n8n-documentation`, `n8n-security-audit`.
- **App:** `frontend-build`, `frontend-scaffold`, starter in `frontend-starter/`.
- **Example:** `examples/workflows/hello-webhook.json` (webhook with CORS and JSON answer; replace `team-xx` with the slot id in its name and path before you create it).
