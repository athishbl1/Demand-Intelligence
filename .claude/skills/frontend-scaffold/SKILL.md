---
name: frontend-scaffold
description: Page patterns for the team's app in the existing frontend-starter/, such as form with result, list with detail, dashboard with key figures, map, chat that talks to an n8n webhook, page per item with a dynamic route. Use when a new page or view is needed in the app. Never create a second app or run create-next-app.
---

# Add pages to the starter

There is **one** app per team: `frontend-starter/`. New views are new pages inside it, not a new app. No `create-next-app`, no second `package.json`. Look, connection to n8n and checks: skill `frontend-build`. Publishing: skill `publish`.

## Where things go

```
app/page.tsx                 start page, becomes the team's app
app/<name>/page.tsx          another page, for example app/about/page.tsx
app/place/[id]/page.tsx      one page per item (dynamic route)
components/<Name>.tsx        reusable parts, for example ResultCard.tsx
lib/app.ts                   name, tagline, accent colour, logo, language
lib/n8n.ts                   callWebhook and webhookUrl (do not change)
lib/<topic>.ts               types and fixed data, for example lib/types.ts
public/                      logo, images
```

Create files directly with the file tool (for example `app/place/[id]/page.tsx`); the folders appear with them. Do not use `mkdir` for paths with square brackets: Claude Code refuses it.

Pages with state or clicks start with `"use client"`. Sub pages set their title with `export const metadata = { title: "About" };` (server components only); the browser tab then shows "About · <app name>".

## Patterns

**Form with result** (the basic pattern, example in `frontend-starter/README.md`): a `card` with `label` and `field`, one `btn` with a `spinner` while waiting, below it a `notice-error` or the result.

**List with detail:** a table (`table-wrap`) or a grid of `card`s, sorted by what matters most (score, distance, date). A click opens the detail below the row (`useState` with the open id) or a page `app/<thing>/[id]/page.tsx`.

**Dashboard:** a row of key figures (`grid sm:grid-cols-3`, each a `card` with a big number and a short label), below a chart or a table. Load all figures with one webhook call.

**Map:** see skill `frontend-build`. Markers from coordinates that n8n delivers; a list next to or below the map for phones.

**Chat with an n8n agent:** a message list and an input. Every message goes to one webhook with `{ sessionId, message }`; the workflow runs an "AI Agent" with a memory node keyed on `sessionId` and answers `{ reply }`. Create the `sessionId` once in the browser (`crypto.randomUUID()`), keep the history in `useState`. Show a `spinner` while the agent thinks.

**Page per item:** `app/place/[id]/page.tsx`. In Next.js 16 `params` is a Promise: `const { id } = await params;` in a server component, or `useParams()` in a client component. Load the data with `callWebhook` in a client component.

**Print or share:** a page with `@media print` rules inside the page (`<style>{"@media print { header, footer, .no-print { display: none } }"}</style>`); leave `app/globals.css` as it is.

## New packages

- First check whether it works without. Every package makes the build slower.
- `npm --prefix frontend-starter install <package>`, then `npm --prefix frontend-starter run build`. `package.json` and `package-lock.json` go into the commit.
- No packages that need keys or their own backend in the browser (no AI SDKs in the app: AI runs in n8n). The exception is `@supabase/supabase-js` with the public anon key of the shared Supabase (skill `supabase`).
