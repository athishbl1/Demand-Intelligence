---
name: n8n-security-audit
description: Security checklist for the team's own n8n workflows before activating them, and a deeper look for workflows that handle sensitive data or will keep running after the hackathon. Covers keys and credentials, public webhooks, cost abuse, error handling and data protection. Use before activating a workflow, before publishing the app, or for a security review.
---

# Security checklist (before activating)

At the hackathon a **short look** over these points is enough. It covers the team's own workflows only.

## Keys and credentials

- [ ] No keys, tokens or passwords in node parameters, Code nodes, workflow JSON in `workflows/` or the app (the public anon key of the shared Supabase is fine in the app as `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- [ ] Every access goes through a credential in n8n (prepared ones or the team's own, named with the slot id)
- [ ] No key was pasted into the chat, apart from the two Supabase exceptions in `AGENTS.md`; if it happened, the team rotates the key

## Webhooks and the app

- [ ] Path starts with the slot id, for example `team-07-search`, and is not guessable as `/test` or `/webhook`
- [ ] Without authentication is fine for this hackathon: the app is public and calls the webhook from the browser, a key in the browser would not protect anything. Instead limit the input: text length, number of items per call (for example at most 10 places), allowed values
- [ ] Webhooks that trigger **paid** calls (DataForSEO, Apify, many model calls) cannot be abused for mass use: small limits per call, a cache in a Data Table, no free choice of the actor or endpoint from the browser
- [ ] The webhook never passes a URL from the browser to an HTTP Request unchecked (server side request forgery); allow only known hosts
- [ ] "Allowed Origins (CORS)" is `*` or the app's address when the app calls the webhook
- [ ] A "Respond to Webhook" node exists when an answer is expected (no hanging calls)
- [ ] Temporary test webhooks are removed after the test
- [ ] Every table of the team in the shared Supabase has Row Level Security on; the app uses only tables with a narrow policy (skill `supabase`)

## Error handling

- [ ] HTTP Request nodes have a sensible error handling ("Retry On Fail", "Continue On Fail" with a clear message to the app)
- [ ] IF and Switch: every output has a target
- [ ] The app gets a readable error instead of a hanging request

## Data and privacy

- [ ] Only public data and own texts, no personal data of real guests
- [ ] No personal data in sticky notes or node names
- [ ] Only the fields that are needed go to a model or an external service
- [ ] Data Tables store only what the app needs
- [ ] The license of each source is respected and named in the app (skill `data-catalog`)
- [ ] No email or message to an address typed into the app: the app is public, otherwise anyone could send mail through it

## General

- [ ] Workflow name is meaningful
- [ ] Validation passed (`n8n_validate_workflow`)
- [ ] Test run with a checked result (skill `n8n-testing`)

---

# Deeper look (sensitive data, running after the event)

## Secret scan in the workflow JSON

- patterns such as `sk-`, `xoxb-`, `Bearer`, `token=`, `apikey=`
- passwords in plain text
- base64 encoded credentials
- addresses with credentials in query parameters

## Webhooks

- no `authentication: "none"` on webhooks that change data
- sensible status codes (not always 200)
- think about abuse and rate limits

## Code nodes

- no `eval()` or `Function()` with outside input
- no unchecked input in HTTP addresses

## Operations

- an error workflow for flows that keep running
- timeouts for long calls
- retries for external services where sensible

## No instance audit

The tool `n8n_audit_instance` checks the whole n8n instance, including other teams' projects. It is blocked for this hackathon. Do not call it and do not look for a way around. Questions about the security of the instance go to the buildbar_ desk.
