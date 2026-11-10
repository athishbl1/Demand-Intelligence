---
name: publish
description: Publishes the team's app from frontend-starter/ at its own address https://<slug>.ttf.buildbar.at with the hub tools publish_app and publish_status. Covers the build check, pushing to main, environment values, waiting for the build without polling, reading build errors and the submission on Sunday 13:00. Use whenever the team wants to publish, update or check the app, or when a build fails.
---

# Publish the app

The hub builds the branch `main` of this repository with Coolify (Nixpacks, Node, port 3000) and serves it at the team's own address. The address comes from the slug of the team name and stays the same for every later publish.

## Steps

1. **Build locally**, from the repository root and without `cd`:
   - `npm --prefix frontend-starter install`
   - `npm --prefix frontend-starter run build`

   The build must be green. Fix type and build errors first: the server runs the same build.
2. **Push to `main`**, one command at a time, without `cd` or `git -C`:
   - `git add ...` and `git commit -m "..."`
   - `git fetch origin main`
   - `git rebase origin/main`
   - `git push origin HEAD:main`

   Never force push. Only `main` is built: whatever sits on another branch (for example the `claude/...` branch of a cloud session) is not in the app.
3. **Call `publish_app`.** Without arguments it publishes the folder `frontend-starter`. Pass `env` only for public values the code needs, as an object of `NEXT_PUBLIC_...` keys. Never pass secrets: every `NEXT_PUBLIC_` value ends up in the browser.
   - If `n8n_url` from `team_info` is not `https://n8n.oi.destination.one`, pass `{"NEXT_PUBLIC_N8N_WEBHOOK_BASE": "<n8n_url>/webhook"}`.
   - If the app uses `supabase-js`, pass `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (skill `supabase`).
   - `NEXT_PUBLIC_` values are set at build time. A new or changed value needs a new publish. Values passed once stay set for later publishes.
4. **Call `publish_status`.** It waits up to 45 seconds by itself for the build. If it still runs, call it again, but not more often than every 30 seconds: every call counts toward the team's usage. The first build takes a few minutes; until it is finished the address shows an error such as "no available server".
5. **When the build is finished** (status `finished`), give the app about 30 more seconds to start, then give the team the address and check it with the test example from `PLAN.md`, also at phone width. Right after the first publish the HTTPS certificate can need up to a minute. Until Let's Encrypt has issued it, the server presents a self-signed placeholder certificate named "TRAEFIK DEFAULT CERT": the browser warns (Chrome and Edge: `NET::ERR_CERT_AUTHORITY_INVALID`) and `curl` fails with `curl: (60) SSL certificate problem: self-signed certificate` (the curl of Windows: `SEC_E_UNTRUSTED_ROOT`). Tell the team to wait a minute and reload instead of accepting the warning. If it is still there after three minutes, do not publish again because of it: the team asks at the buildbar_ desk.
6. **Later changes:** build, commit, push, `publish_app` again. The address stays.

Do not end your turn with "I will check back later": either wait with `publish_status` as above, or tell the team plainly that the build is still running and that they can ask you for the status.

## When it fails

| What the tool reports | What it means and what you do |
|---|---|
| `git commit` stops with "Author identity unknown" | No commit identity on this computer. Ask the person at this computer for the name and email address to use (their GitHub noreply address, under GitHub Settings, Emails, keeps their own address private) and set them for this repository only, without `--global`: `git config user.name "<name>"`, `git config user.email "<email>"`. Never make them up and never copy them from `git log`, a team member or another account. Then commit again. |
| `git push` rejected with "GH007: Your push would publish a private email address" | Set the person's GitHub noreply address with `git config user.email "<noreply address>"`, rewrite the unpushed commits with `git rebase origin/main --exec "git commit --amend --no-edit --reset-author"` and push again. Never force. |
| Error lines from the build (TypeScript, missing module, ...) | A real error in the code. Fix it, run the build locally, push and publish again. |
| "Could not resolve hostname", "Try again", a failed clone or download | A network hiccup on the build server, not the code. Publish again without changes. |
| No deploy key, no repository, publishing not set up | The slot is not fully set up. The team asks at the buildbar_ desk. |
| Status `finished`, but the page shows old content | The push did not reach `main`, or the build ran before the push. Check `git log origin/main -1`, push, publish again. |
| The page loads, but every request to n8n fails | Check the CORS option "Allowed Origins (CORS)" of the Webhook node, that the workflow is active, and the webhook base (see step 3). The error text of `callWebhook()` names the cause. |

## Submission

- The submission is on **Sunday 13:00 CET**. A build takes a few minutes, so publish the final version well before.
- Publish early on Saturday and after every stage that works. Then there is always a working version at the address, also during the pitch.
- Never commit `.next/`, `node_modules/` or `*.tsbuildinfo` (`.gitignore` takes care of it). A committed `tsbuildinfo` breaks the build.
