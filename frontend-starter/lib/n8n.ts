/**
 * Connection to n8n: the app sends data to a webhook of the team's workflow and gets the answer back.
 *
 * The base address comes from NEXT_PUBLIC_N8N_WEBHOOK_BASE, which is set at build time, for example
 * https://n8n.oi.destination.one/webhook. NEXT_PUBLIC_N8N_BASE, the n8n address without /webhook,
 * works as well. Without either of them the default below applies.
 * Never put keys into NEXT_PUBLIC_ values: everything in the browser is public.
 */
const DEFAULT_WEBHOOK_BASE = "https://n8n.oi.destination.one/webhook";

/** NEXT_PUBLIC_N8N_BASE is the n8n address itself; the webhooks live below it under /webhook. */
const N8N_BASE = (process.env.NEXT_PUBLIC_N8N_BASE || "").trim().replace(/\/+$/, "");
const BASE_FROM_N8N = N8N_BASE ? (/\/webhook$/.test(N8N_BASE) ? N8N_BASE : `${N8N_BASE}/webhook`) : "";

const WEBHOOK_BASE = (process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE || BASE_FROM_N8N || DEFAULT_WEBHOOK_BASE)
  .trim()
  .replace(/\/+$/, "");

/** The n8n address without the trailing /webhook, for paths like "webhook-test/...". */
const N8N_ROOT = WEBHOOK_BASE.replace(/\/webhook$/, "");

/** Default wait: 120 seconds. Workflows with several AI steps or scrapers can take a while. */
const DEFAULT_TIMEOUT_MS = 120_000;

/** Error of a webhook call. `status` is the HTTP status, or null when n8n did not answer at all. */
export class WebhookError extends Error {
  readonly path: string;
  readonly status: number | null;

  constructor(message: string, path: string, status: number | null = null) {
    super(message);
    this.name = "WebhookError";
    this.path = path;
    this.status = status;
  }
}

export type WebhookOptions = {
  /** Maximum wait in milliseconds, default 120 000. */
  timeoutMs?: number;
  /** POST sends `data` as JSON (default). GET sends it as query string. */
  method?: "POST" | "GET";
  /** Optional signal to cancel the call, for example when a component unmounts. */
  signal?: AbortSignal;
};

/**
 * Full address of a webhook.
 * webhookUrl("team-07-search") gives https://n8n.oi.destination.one/webhook/team-07-search.
 * A path that starts with "webhook/" or "webhook-test/" is taken relative to the n8n address,
 * a full https:// address stays as it is.
 */
export function webhookUrl(path: string): string {
  const clean = path.trim();
  if (/^https?:\/\//i.test(clean)) return clean;
  const withoutSlash = clean.replace(/^\/+/, "");
  if (/^webhook(-test)?\//.test(withoutSlash)) return `${N8N_ROOT}/${withoutSlash}`;
  return `${WEBHOOK_BASE}/${withoutSlash}`;
}

/**
 * Sends `data` to the webhook `path` and returns the answer.
 *
 * - If n8n answers with JSON, the parsed object comes back, otherwise the text.
 * - Waits at most `options.timeoutMs` milliseconds (default 120 000).
 * - On an error status, a timeout or a failed connection it throws a WebhookError with an
 *   English message that names the likely cause. Show `error.message` in a `notice-error`.
 *
 * Examples:
 *   const result = await callWebhook<{ places: Place[] }>("team-07-search", { place: "St. Gilgen" });
 *   const report = await callWebhook("team-07-report", { id: 7 }, { timeoutMs: 180_000 });
 *   const status = await callWebhook("team-07-status", { job: "abc" }, { method: "GET" });
 */
export async function callWebhook<T = unknown>(path: string, data?: unknown, options: WebhookOptions = {}): Promise<T> {
  if (options.signal?.aborted) {
    throw new WebhookError(`The call to webhook "${path}" was cancelled.`, path);
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const method = options.method ?? "POST";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });

  let url = webhookUrl(path);
  const init: RequestInit = { method, signal: controller.signal, headers: { Accept: "application/json" } };
  if (method === "GET") {
    const query = toQuery(data);
    if (query) url += (url.includes("?") ? "&" : "?") + query;
  } else {
    init.headers = { Accept: "application/json", "Content-Type": "application/json" };
    init.body = JSON.stringify(data ?? {});
  }

  try {
    let response: Response;
    let text: string;
    try {
      response = await fetch(url, init);
      text = await response.text();
    } catch (error) {
      if (options.signal?.aborted) {
        throw new WebhookError(`The call to webhook "${path}" was cancelled.`, path);
      }
      if (controller.signal.aborted) {
        const seconds = Math.max(1, Math.round(timeoutMs / 1000));
        throw new WebhookError(
          `No answer from n8n after ${seconds} ${seconds === 1 ? "second" : "seconds"} (webhook "${path}"). ` +
            "The workflow may still be running: check its execution in n8n, or allow more time with timeoutMs.",
          path,
        );
      }
      const detail = error instanceof Error && error.message ? ` (${error.message})` : "";
      throw new WebhookError(
        `Could not reach n8n (webhook "${path}"). Usual causes: the Webhook node does not allow this site ` +
          '(set "Allowed Origins (CORS)" to *), the workflow is not active, or there is no network.' +
          detail,
        path,
      );
    }

    if (!response.ok) {
      throw new WebhookError(`${reason(response.status, path)}${excerpt(text)}`, path, response.status);
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}

function toQuery(data: unknown): string {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  return params.toString();
}

function reason(status: number, path: string): string {
  if (status === 404) {
    return `Webhook "${path}" not found (404): the workflow is not active, or the path or the HTTP method is wrong.`;
  }
  if (status === 401 || status === 403) {
    return `Webhook "${path}" refused the call (${status}): check the authentication of the Webhook node.`;
  }
  if (status >= 500) {
    return `The workflow behind webhook "${path}" failed (${status}). Check its execution in n8n.`;
  }
  return `Webhook "${path}" rejected the request (${status}).`;
}

/** Start of the error answer from n8n, it helps to find the cause. */
function excerpt(text: string): string {
  const short = text.replace(/\s+/g, " ").trim().slice(0, 200);
  return short ? ` n8n says: ${short}` : "";
}
