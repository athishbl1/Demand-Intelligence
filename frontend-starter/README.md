# Frontend starter

The base for your team's web app at the TTF Hackathon 2026. Tell your coding agent what the app should do; it builds the pages from this starter and gets the data from your n8n workflow.

## At a glance

- **Tech:** Next.js 16.4.5 (App Router), React 19, TypeScript, Tailwind 4, npm.
- **Data:** from n8n webhooks under `https://n8n.oi.destination.one/webhook/...` (or the base in `NEXT_PUBLIC_N8N_WEBHOOK_BASE`).
- **Look:** light and neutral with one accent colour. Name, tagline, colour, logo and language live in `lib/app.ts`.
- **Publishing:** with the hub tool `publish_app` (see skill `publish`). `npm run build` must be green first.

Keys and passwords never belong in the app: everything here is visible in the browser. Access to services stays in n8n credentials. The one exception is the public anon key of the shared Supabase, only as `NEXT_PUBLIC_SUPABASE_ANON_KEY` (in `.env.local` locally, in the `env` of `publish_app` for the published app, never in a committed file), for tables with Row Level Security and a narrow policy (skill `supabase`).

## Name, colour, logo: `lib/app.ts`

```ts
export const APP = {
  name: "TTF Hackathon App", // header and browser tab
  tagline: "", // small line below the name, "" for none
  accent: "#0f766e", // buttons, links, notices and the bar in the header
  logo: "", // "/logo.svg" (file in public/) or a full address, "" for no logo
  lang: "en", // language of the page
};
```

Pick a strong, rather dark accent colour: white text sits on it. The light variant for notices is computed by the page.

## Building blocks

The CSS classes are described at the top of `app/globals.css`. Layout and spacing come from Tailwind (`flex`, `grid`, `gap-4` ...).

| Class | Use |
|---|---|
| `page-title` | page title with a short bar in the accent colour |
| `card` | white surface with border for forms and results |
| `label`, `field` | label and input, select or textarea |
| `btn`, `btn-secondary` | main button (filled) and secondary button (outlined) |
| `notice`, `notice-error` | box for results and hints, box for errors |
| `table-wrap` | on a `<div>` around a `<table>`, wide tables scroll inside it |
| `badge-green`, `badge-yellow`, `badge-red`, `badge-gray` | status, for example open, limited, closed, unknown |
| `spinner`, `skeleton` | spinning circle while waiting, shimmering placeholder |

Matching colour classes: `text-accent`, `bg-accent`, `bg-accent-light`, `border-accent`, `text-muted`, `border-line`, `bg-surface-muted`.

## Data from n8n: `callWebhook`

`callWebhook` from `lib/n8n.ts` sends data as JSON to `<base>/<path>` and returns the answer. It waits up to 120 seconds. If something goes wrong it throws a `WebhookError` with a clear English message that you can show directly.

```tsx
"use client";
import { useState } from "react";
import { callWebhook } from "@/lib/n8n";

export default function SearchPage() {
  const [result, setResult] = useState<{ text: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function search(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const town = String(new FormData(e.currentTarget).get("town") ?? "");
    setLoading(true);
    setError("");
    try {
      setResult(await callWebhook<{ text: string }>("team-07-search", { town }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={search} className="card flex flex-col gap-4">
        <div>
          <label htmlFor="town" className="label">Town</label>
          <input id="town" name="town" className="field" required />
        </div>
        <button type="submit" className="btn self-start" disabled={loading}>
          {loading && <span className="spinner" aria-hidden="true" />}
          {loading ? "Loading ..." : "Search"}
        </button>
      </form>
      {error && <div role="alert" className="notice-error">{error}</div>}
      {result && <div className="notice">{result.text}</div>}
    </div>
  );
}
```

Replace `team-07` with your slot id from `team.md`. For a longer workflow allow more time: `callWebhook("path", data, { timeoutMs: 180_000 })`. In the n8n Webhook node set "Allowed Origins (CORS)" to `*` and answer with "Respond to Webhook".

## Build and run

From the repository root:

```
npm --prefix frontend-starter install
npm --prefix frontend-starter run build
npm --prefix frontend-starter run dev
```

The build must be green before publishing. The starter needs Node 20.9 or newer; `npm start` runs on port 3000 or on the port in `PORT`.

## What is where

```
app/layout.tsx       frame of every page: header, content, footer
app/page.tsx         start page, becomes your app
app/globals.css      look and building blocks
components/          Header.tsx and Footer.tsx
lib/app.ts           name, tagline, accent colour, logo, language
lib/n8n.ts           callWebhook, webhookUrl, WebhookError
public/              images, logo, favicon
```
