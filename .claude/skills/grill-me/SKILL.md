---
name: grill-me
description: Checks the team's PLAN.md with 3 to 5 short questions before building, one at a time and each with a recommended answer. Focus on whether stage 1 runs end to end within about two hours, whether the data access is real, whether each stage has a test with an expected result, and whether the scope fits until the submission on Sunday 13:00. Use after idea-to-plan, or when the team says "grill me", "check our plan" or "poke holes in this". Without a PLAN.md, run idea-to-plan first.
---

# Check the plan: ask until it is clear

You check the plan before anything is built. Friendly in tone, clear in substance. In this phase you create nothing in n8n. Looking things up is fine: read `PLAN.md`, the challenge feed and skill `data-catalog`, search nodes.

## How you ask

- One sentence to start: "Before we build, a few quick questions on the plan."
- **3 to 5 questions, one at a time.** Only what is really open for the build. Do not ask again what `PLAN.md` already answers.
- Give your **recommended answer** with every question, so the team can simply say yes.
- Look up what can be looked up instead of asking. The team makes the decisions.
- If the team says "show us the plan" or "let's build", stop asking right away.

## What you check (pick what matters for this plan)

1. **Stage 1 within about two hours?** One input, one source, one result through a webhook. Otherwise cut it smaller.
2. **Data access real?** Is the Data Space access granted, the API reachable, the open data covering the region? If not: which fallback source for stage 1?
3. **Tests:** does every stage have a real example and an expected result that shows it is right, not only that it ran?
4. **Scope:** does everything fit until the submission on Sunday 13:00, with time to publish and to prepare the pitch? What moves to "Later"?
5. **Cost and limits:** DataForSEO and Apify cost per call, Apify runs take 30 to 120 seconds, Nominatim allows one request per second. Does the plan respect that?
6. **Team split:** who owns which workflow and which part of the app, so no two agents edit the same workflow?
7. **The pitch:** what is the one moment in the demo that shows the value for the challenge partner?
8. **The look:** app name, accent colour and logo, so the build does not stop for it later. Recommend a colour that fits the challenge partner or the idea.

## Then: the build plan

Update `PLAN.md` with the answers: goal in one sentence, stages with trigger, steps, sources and test, names (workflow names, Data Table names, webhook paths and Supabase tables or buckets, each starting with the slot id; Supabase tables in underscore form such as `team_07_places`), owners, "Later". Commit and push it. When the team agrees, start building as described in `AGENTS.md`.

---
*Adapted from [mattpocock/skills](https://github.com/mattpocock/skills) (`grilling` and `grill-me`), MIT license, © Matt Pocock.*
