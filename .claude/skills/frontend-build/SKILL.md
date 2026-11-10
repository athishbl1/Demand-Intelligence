---
name: frontend-build
description: Builds the team's web app in frontend-starter/ (Next.js 16.4.5, React 19, TypeScript, Tailwind 4) on top of its n8n workflow. Name, tagline, accent colour, logo and language in lib/app.ts, ready-made CSS building blocks, calling webhooks with callWebhook() from lib/n8n.ts, CORS, the shared Supabase with supabase-js, loading states, slow sources and long jobs, maps and checks before showing. Use when building, styling, connecting or debugging the app. Publishing itself is in skill publish.
---

# Build the app

The app is what the team shows in the pitch and shares afterwards. It lives in **`frontend-starter/`** and gets its data from webhooks of the team's own n8n workflow. Everything with keys, sources and AI runs in n8n; the app shows and collects. The app may also use the shared Supabase directly with `supabase-js` and the public anon key: tables with Row Level Security and a narrow policy, test logins and the own rows of signed-in test users (skill `supabase`). Writes with the service_role key go through n8n.

## Stack

- Next.js 16.4.5 (App Router), React 19, TypeScript (strict), Tailwind 4, npm. Everything is set up in the starter.
- Pages live in `app/`. Each page returns only its content: header, footer and `<main>` come from `app/layout.tsx`.
- **No backend in the app:** no API routes, no server actions with keys, no secrets. Whatever runs in the browser is public, every `NEXT_PUBLIC_` value included.
- Do not store anything in the app's file system; it is gone with the next publish. Data belongs in n8n (Data Table) or the shared Supabase.
- Build from the repository root: `npm --prefix frontend-starter install`, then `npm --prefix frontend-starter run build`. Local preview: `npm --prefix frontend-starter run dev` (port 3000).

## Look

Name, tagline, accent colour, logo and language are set in `lib/app.ts` only:

```ts
export const APP = {
  name: "Lake Day Planner",
  tagline: "Weather and sights for your day at the lake",
  accent: "#0f766e", // strong and rather dark: white text sits on it
  logo: "",          // "/logo.svg" in public/ or a full https:// address, "" for none
  lang: "en",        // language of the page, for example "de"
};
```

Header, buttons, notices and focus rings follow the accent colour. Ask the team for its colour once (skill `grill-me` does that).

**Building blocks** (CSS classes, described at the top of `app/globals.css`):

| Class | Use |
|---|---|
| `page-title` | page title on `<h1>`, with a short accent bar |
| `card` | white surface with border, for forms and results |
| `label`, `field` | label and input, select or textarea |
| `btn`, `btn-secondary` | main button (one per form) and secondary button |
| `notice`, `notice-error` | box for results and hints, red box for errors (with `role="alert"`) |
| `table-wrap` | on a `<div>` around a `<table>`: wide tables scroll inside it |
| `badge-green`, `badge-yellow`, `badge-red`, `badge-gray` | small status label, always with a word, never colour alone |
| `spinner`, `skeleton` | spinning circle on an empty `<span>`, shimmering placeholder (height via Tailwind, for example `h-24`) |

Layout and spacing with Tailwind (`flex`, `grid`, `gap-4`, `sm:grid-cols-2`). Colour classes: `text-accent`, `bg-accent`, `bg-accent-light`, `border-accent`, `text-muted`, `border-line`, `bg-surface-muted`. A free design is fine too: the starter is a base, not a cage.

**Phone first.** Judges and testers often open the address on a phone. At 375 px nothing may scroll sideways except a table inside its `table-wrap`.

## Connecting to n8n

```tsx
"use client";
import { callWebhook } from "@/lib/n8n";

const result = await callWebhook<Result>("team-07-search", { place, date });
```

- `callWebhook(path, data, { timeoutMs, method })` sends JSON by POST (or the data as query string with `method: "GET"`) to `<NEXT_PUBLIC_N8N_WEBHOOK_BASE>/<path>` and waits up to 120 seconds by default. Default base: `https://n8n.oi.destination.one/webhook`. A full `https://` address is used as it is.
- Errors come as `WebhookError` with an English message that names the likely cause (not active, CORS, timeout, workflow error). Show `error.message` in a `notice-error`.
- Pages with `useState`, `onClick` or `callWebhook` need `"use client"` at the top.
- **In the workflow:** Webhook node with `httpMethod: "POST"`, path starting with the slot id from `team.md`, `responseMode: "responseNode"`, option "Allowed Origins (CORS)" (`options.allowedOrigins`) set to `*`, and a "Respond to Webhook" node that answers with JSON. The request body is under `$json.body`.
- **Local development** against another n8n: `frontend-starter/.env.local` with `NEXT_PUBLIC_N8N_WEBHOOK_BASE=...` (see `.env.local.example`). For the published app pass the same value to `publish_app` (skill `publish`).

## Waiting, slow sources, long jobs

- Show a loading state for every request: `spinner` in the button, `skeleton` where the result will appear, and a sentence if it takes long ("Collecting reviews takes about a minute").
- **Several slow sources:** one request per source, all started at once, every result shown as soon as it arrives:

```tsx
const SOURCES = ["osm", "weather", "events"] as const;
SOURCES.forEach((source) => {
  callWebhook<SourceResult>("team-07-source", { source, place }, { timeoutMs: 150_000 })
    .then((r) => setResults((old) => ({ ...old, [source]: r })))
    .catch((e) => setErrors((old) => ({ ...old, [source]: e instanceof Error ? e.message : String(e) })));
});
```

- **Jobs longer than about a minute** (Apify runs, many AI calls): one webhook starts the job, writes progress to a Data Table and answers at once with a job id; a second webhook returns the state; the app asks every 5 to 10 seconds until it is done. Do not keep one request open for minutes.
- A field like `status: "not_found"` is a result, not an error: show it with a `badge-gray` and the reason.
- Several inputs (a list of places): send them one after the other or in small groups, not 50 at once.

## Maps and charts

- **Map:** `npm --prefix frontend-starter install leaflet react-leaflet` and `npm --prefix frontend-starter install -D @types/leaflet`. Load the map component only in the browser: `const Map = dynamic(() => import("@/components/Map"), { ssr: false });` inside a client component. OpenStreetMap tiles need the attribution "© OpenStreetMap contributors". Coordinates come from n8n (geocoding there, never from the browser).
- **Charts:** a small library such as `recharts`, or plain SVG for one or two simple charts.
- Every new package makes the build slower. Check first whether it works without.

## Check before showing

- `npm --prefix frontend-starter run build` is green.
- In the browser with the test example from `PLAN.md`: the normal case, a case without results, an error case (workflow switched off).
- Phone width (375 px): nothing breaks, buttons are big enough.
- Loading state visible, errors as text, status never by colour alone.
- Sources and licenses of the data are named on the page (skill `data-catalog`).
- No keys (the Supabase anon key only through `NEXT_PUBLIC_SUPABASE_ANON_KEY`), no personal data of real guests, no leftover `console.log` in the code.

## Accessible in a minute

- Use `<button>`, `<label htmlFor>` and `<table>`, not clickable `<div>`s.
- Images get `alt`, icon-only buttons get `aria-label`.
- Errors with `role="alert"`, loading with `aria-busy` or a text.
